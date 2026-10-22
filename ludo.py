"""Ludo rules and board geometry, shared by local, CPU and private-room play."""
import random
import time
from game import GameError

TRACK = [(6,13),(6,12),(6,11),(6,10),(6,9),(5,8),(4,8),(3,8),(2,8),(1,8),(0,8),(0,7),(0,6),(1,6),(2,6),(3,6),(4,6),(5,6),(6,5),(6,4),(6,3),(6,2),(6,1),(6,0),(7,0),(8,0),(8,1),(8,2),(8,3),(8,4),(8,5),(9,6),(10,6),(11,6),(12,6),(13,6),(14,6),(14,7),(14,8),(13,8),(12,8),(11,8),(10,8),(9,8),(8,9),(8,10),(8,11),(8,12),(8,13),(8,14),(7,14),(6,14)]
LANES = [[(7,y) for y in range(13,8,-1)]+[(7,7)],[(x,7) for x in range(1,6)]+[(7,7)],[(7,y) for y in range(1,6)]+[(7,7)],[(x,7) for x in range(13,8,-1)]+[(7,7)]]
YARDS = [[(1.8,10.8),(3.2,10.8),(1.8,12.2),(3.2,12.2)],[(1.8,1.8),(3.2,1.8),(1.8,3.2),(3.2,3.2)],[(10.8,1.8),(12.2,1.8),(10.8,3.2),(12.2,3.2)],[(10.8,10.8),(12.2,10.8),(10.8,12.2),(12.2,12.2)]]
SAFE = {0,8,13,21,26,34,39,47}
COLORS = ['#35b9ee','#ff7388','#9bd465','#ffd06a']


def initialise(game):
    game.update(phase='roll', pending_roll=None, legal_tokens=[], consecutive_sixes=0)
    game['message']='Roll a six to bring a token out of your yard.'
    for player in game['players']:
        player['tokens']=[-1]*4
    return game


def legal_tokens(game, die):
    return [i for i,p in enumerate(game['players'][game['turn']]['tokens']) if (p == -1 and die == 6) or (0 <= p < 56 and p+die <= 56)]


def validate(game,version,phase,now):
    if game['status']!='playing' or game['winner'] is not None:
        raise GameError('This game is not taking turns right now.')
    if version!=game['version']:
        raise GameError('The board changed. Try your turn again.')
    if now<game['ready_at']:
        raise GameError('Let the current animation finish first.')
    if game['phase']!=phase:
        raise GameError('Choose a highlighted token.' if phase=='roll' else 'Roll the dice first.')


def record(game,event,now,duration):
    game['version']+=1
    event['id']=game['version']
    game['events']=(game['events']+[event])[-20:]
    game['ready_at']=now+duration
    return event


def pass_turn(game):
    game['turn']=(game['turn']+1)%len(game['players'])
    game['consecutive_sixes']=0
    game['phase']='roll'
    game['pending_roll']=None
    game['legal_tokens']=[]


def roll_ludo(game,version,roll=None,now=None):
    now=time.time() if now is None else now
    validate(game,version,'roll',now)
    die=random.randint(1,6) if roll is None else roll
    if not isinstance(die,int) or not 1<=die<=6:
        raise GameError('Invalid dice roll.')
    seat=game['turn']
    game['dice'][seat]=die
    game['pending_roll']=die
    game['consecutive_sixes']=game['consecutive_sixes']+1 if die==6 else 0
    game['legal_tokens']=legal_tokens(game,die)
    event={'type':'roll','player':seat,'roll':die,'walk':[],'special':None}
    name=game['players'][seat]['name']
    if game['consecutive_sixes']==3:
        game['message']=f'{name}: three sixes in a row. Turn passes.'
        pass_turn(game)
    elif not game['legal_tokens']:
        game['message']=f'{name} rolled {die}. No legal move; turn passes.'
        pass_turn(game)
    else:
        game['phase']='choose'
        game['message']=f'{name} rolled {die}. Choose a highlighted token.'
    return record(game,event,now,1.05)


def move_ludo(game,version,token,now=None):
    now=time.time() if now is None else now
    validate(game,version,'choose',now)
    if not isinstance(token,int) or token not in game['legal_tokens']:
        raise GameError('Choose a highlighted token belonging to the active player.')
    seat=game['turn']; player=game['players'][seat]; die=game['pending_roll']
    origin=player['tokens'][token]
    destination=0 if origin==-1 else origin+die
    walk=[0] if origin==-1 else list(range(origin+1,destination+1))
    player['tokens'][token]=destination
    captures=[]
    if destination<=50:
        cell=(seat*13+destination)%52
        if cell not in SAFE:
            for rival,other in enumerate(game['players']):
                if rival==seat: continue
                for piece,progress in enumerate(other['tokens']):
                    if 0<=progress<=50 and (rival*13+progress)%52==cell:
                        captures.append({'player':rival,'token':piece,'origin':progress})
                        other['tokens'][piece]=-1
    player['position']=sum(p==56 for p in player['tokens'])
    special='capture' if captures else 'home' if destination==56 else None
    event={'type':'move','player':seat,'token':token,'roll':die,'origin':origin,'destination':destination,'walk':walk,'captures':captures,'special':special}
    name=player['name']
    game['message']=(f'{name} brought a token home!' if destination==56 else
                     f'{name} captured {len(captures)} '+('token!' if len(captures)==1 else 'tokens!') if captures else
                     f'{name} joined the race!' if origin==-1 else
                     f'{name} moved '+('one square.' if len(walk)==1 else f'{len(walk)} squares.'))
    if player['position']==4:
        game['winner']=seat
        game['message']=f'{name} brought all four tokens home!'
    elif die==6:
        game.update(phase='roll',pending_roll=None,legal_tokens=[])
        game['message']+=' A six earns another roll.'
    else:
        pass_turn(game)
    return record(game,event,now,.35+len(walk)*.17+(.5 if captures else 0))


def layout():
    return {'track':TRACK,'lanes':LANES,'yards':YARDS}


def board_svg():
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="Ludo board"><rect width="600" height="600" fill="#eae5d9"/>']
    for seat,(x,y) in enumerate([(0,9),(0,0),(9,0),(9,9)]):
        color=COLORS[seat]
        parts.append(f'<rect x="{x*40}" y="{y*40}" width="240" height="240" fill="{color}"/><rect x="{x*40+28}" y="{y*40+28}" width="184" height="184" rx="24" fill="#f7f3e9"/>')
        for px,py in YARDS[seat]:
            parts.append(f'<circle cx="{px*40+20}" cy="{py*40+20}" r="23" fill="{color}" fill-opacity=".25" stroke="{color}" stroke-width="2"/>')
        for cx,cy in LANES[seat][:-1]:
            parts.append(f'<rect x="{cx*40}" y="{cy*40}" width="40" height="40" fill="{color}" stroke="#314253" stroke-width="1"/>')
    for index,(x,y) in enumerate(TRACK):
        fill=COLORS[index//13] if index%13==0 else '#fbf4e5'
        parts.append(f'<rect x="{x*40}" y="{y*40}" width="40" height="40" fill="{fill}" stroke="#536474" stroke-width="1"/>')
        if index in SAFE:
            parts.append(f'<text x="{x*40+20}" y="{y*40+27}" text-anchor="middle" font-size="25" fill="#42566b">☆</text>')
    for seat,points in enumerate(['240,360 360,360 300,300','240,240 240,360 300,300','240,240 360,240 300,300','360,240 360,360 300,300']):
        parts.append(f'<polygon points="{points}" fill="{COLORS[seat]}" stroke="#f7f3e9" stroke-width="2"/>')
    parts.append('<circle cx="300" cy="300" r="22" fill="#f7f3e9"/><text x="300" y="307" text-anchor="middle" font-size="24" fill="#263951">♛</text></svg>')
    return ''.join(parts)
