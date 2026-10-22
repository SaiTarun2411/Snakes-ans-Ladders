import unittest
import xml.etree.ElementTree as ET
from game import GameError, RoomStore, new_game, play_turn
from ludo import TRACK, LANES, board_svg, move_ludo, roll_ludo


class LudoTests(unittest.TestCase):
    def game(self,count=4): return new_game(count,game_type='ludo')

    def test_four_tokens_each_and_geometry(self):
        game=self.game()
        self.assertEqual([p['tokens'] for p in game['players']],[[-1]*4 for _ in range(4)])
        self.assertEqual(len(TRACK),52)
        self.assertEqual(len(set(TRACK)),52)
        self.assertEqual([len(p) for p in LANES],[6]*4)
        ET.fromstring(board_svg())

    def test_six_releases_token_and_earns_roll(self):
        game=self.game()
        play_turn(game,0,6,now=100)
        self.assertEqual(game['legal_tokens'],[0,1,2,3])
        with self.assertRaises(GameError):move_ludo(game,1,0,now=100.1)
        event=move_ludo(game,1,0,now=102)
        self.assertEqual(event['walk'],[0])
        self.assertEqual(game['players'][0]['tokens'],[0,-1,-1,-1])
        self.assertEqual(game['turn'],0)
        self.assertEqual(game['phase'],'roll')

    def test_no_six_passes_when_all_tokens_in_yard(self):
        game=self.game()
        roll_ludo(game,0,3,now=100)
        self.assertEqual(game['turn'],1)
        self.assertEqual(game['phase'],'roll')
        self.assertEqual(game['players'][0]['tokens'],[-1]*4)

    def test_choice_and_walk(self):
        game=self.game();game['players'][0]['tokens']=[3,10,-1,-1]
        roll_ludo(game,0,4,now=100)
        self.assertEqual(game['legal_tokens'],[0,1])
        event=move_ludo(game,1,1,now=102)
        self.assertEqual(event['walk'],[11,12,13,14])
        self.assertEqual(game['players'][0]['tokens'][0],3)
        self.assertEqual(game['turn'],1)

    def test_captures_return_opponent_to_yard(self):
        game=self.game();game['players'][0]['tokens'][0]=4;game['players'][1]['tokens'][2]=44
        roll_ludo(game,0,1,now=100)
        event=move_ludo(game,1,0,now=102)
        self.assertEqual(game['players'][1]['tokens'][2],-1)
        self.assertEqual(event['captures'],[{'player':1,'token':2,'origin':44}])
        self.assertEqual(game['turn'],1)

    def test_safe_square_prevents_capture(self):
        game=self.game();game['players'][0]['tokens'][0]=7;game['players'][1]['tokens'][0]=47
        roll_ludo(game,0,1,now=100)
        event=move_ludo(game,1,0,now=102)
        self.assertEqual(event['captures'],[])
        self.assertEqual(game['players'][1]['tokens'][0],47)

    def test_home_lane_protected_from_capture(self):
        game=self.game();game['players'][0]['tokens'][0]=50;game['players'][1]['tokens'][0]=38
        roll_ludo(game,0,1,now=100)
        move_ludo(game,1,0,now=102)
        self.assertEqual(game['players'][0]['tokens'][0],51)
        self.assertEqual(game['players'][1]['tokens'][0],38)

    def test_exact_home_and_winner_every_seat(self):
        for seat in range(4):
            game=self.game();game['turn']=seat;game['players'][seat]['tokens']=[56,56,56,55]
            roll_ludo(game,0,1,now=100)
            move_ludo(game,1,3,now=102)
            self.assertEqual(game['winner'],seat)
            self.assertEqual(game['players'][seat]['position'],4)
            with self.assertRaises(GameError):roll_ludo(game,2,6,now=200)

    def test_overshoot_is_illegal(self):
        game=self.game();game['players'][0]['tokens']=[55,56,56,56]
        roll_ludo(game,0,3,now=100)
        self.assertEqual(game['turn'],1)
        self.assertEqual(game['players'][0]['tokens'][0],55)

    def test_three_sixes_forfeit(self):
        game=self.game()
        roll_ludo(game,0,6,now=100);move_ludo(game,1,0,now=102)
        roll_ludo(game,2,6,now=105);move_ludo(game,3,0,now=107)
        roll_ludo(game,4,6,now=110)
        self.assertEqual(game['turn'],1)
        self.assertEqual(game['players'][0]['tokens'][0],6)
        self.assertEqual(game['phase'],'roll')

    def test_wrong_phase_piece_and_replay_rejected(self):
        game=self.game()
        with self.assertRaises(GameError):move_ludo(game,0,0,now=100)
        roll_ludo(game,0,6,now=100)
        with self.assertRaises(GameError):roll_ludo(game,1,6,now=102)
        with self.assertRaises(GameError):move_ludo(game,1,8,now=102)
        with self.assertRaises(GameError):move_ludo(game,0,0,now=102)
        self.assertEqual(game['players'][0]['tokens'],[-1]*4)

    def test_rooms_share_ludo_and_enforce_seat(self):
        store=RoomStore();code=store.create('a','Alice',2,'ludo');store.join(code,'b','Bob')
        store.action(code,'a','start')
        store.rooms[code]['game']['players'][0]['tokens'][0]=2
        with self.assertRaises(GameError):store.action(code,'b','roll',0)
        store.action(code,'a','roll',0)
        store.rooms[code]['game']['ready_at']=0
        with self.assertRaises(GameError):store.action(code,'b','move',1,0)
        store.action(code,'a','move',1,0)
        self.assertEqual(store.snapshot(code,'a')[0],store.snapshot(code,'b')[0])
        self.assertEqual(store.snapshot(code,'b')[0]['game_type'],'ludo')


if __name__=='__main__':unittest.main()
