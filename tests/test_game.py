import unittest
from concurrent.futures import ThreadPoolExecutor
from game import GameError, LADDERS, SNAKES, RoomStore, new_game, play_turn


class RulesTests(unittest.TestCase):
    def test_original_layout(self):
        self.assertEqual(LADDERS, {2:38,7:14,8:31,15:26,21:42,28:84,36:44,51:67,71:91,78:98})
        self.assertEqual(SNAKES, {16:6,46:25,49:11,62:19,64:60,74:53,89:68,92:88,95:75,99:80})

    def test_one_to_four_players(self):
        for count in range(1, 5):
            game = new_game(count)
            for i in range(count):
                event=play_turn(game, i, 1, now=i*10)
                self.assertEqual(event['player'], i)
            self.assertEqual(game['turn'], 0)

    def test_walking_and_ladder(self):
        game=new_game(4)
        event=play_turn(game, 0, 2, now=100)
        self.assertEqual(event['walk'], [1, 2])
        self.assertEqual(event['destination'], 38)
        self.assertEqual(event['special'], 'ladder')

    def test_snake(self):
        game=new_game()
        game['players'][0]['position']=10
        event=play_turn(game, 0, 6, now=100)
        self.assertEqual(event['walk'], list(range(11,17)))
        self.assertEqual(event['destination'], 6)
        self.assertEqual(game['turn'], 1)

    def test_overshoot(self):
        game=new_game()
        game['players'][0]['position']=99
        event=play_turn(game, 0, 6, now=100)
        self.assertEqual(event['walk'], [])
        self.assertEqual(game['players'][0]['position'], 99)
        self.assertEqual(game['turn'], 1)

    def test_every_player_can_win(self):
        for winner in range(4):
            game=new_game(4)
            game['turn']=winner
            game['players'][winner]['position']=99
            play_turn(game,0,1,now=100)
            self.assertEqual(game['winner'],winner)
            with self.assertRaises(GameError): play_turn(game,1,1,now=200)

    def test_replay_and_rapid_rolls_rejected(self):
        game=new_game()
        play_turn(game,0,1,now=100)
        with self.assertRaises(GameError): play_turn(game,0,1,now=200)
        with self.assertRaises(GameError): play_turn(game,1,1,now=100.1)
        self.assertEqual(game['version'],1)

    def test_computers(self):
        game=new_game(4,'computer')
        self.assertEqual([p['kind'] for p in game['players']],['human','computer','computer','computer'])


class RoomTests(unittest.TestCase):
    def setUp(self):
        self.store=RoomStore()
        self.code=self.store.create('host','Alice',2)
        self.store.join(self.code,'guest','Bob')

    def test_shared_board_and_turn_authorization(self):
        self.store.action(self.code,'host','start')
        with self.assertRaises(GameError): self.store.action(self.code,'guest','roll',0)
        self.store.action(self.code,'host','roll',0)
        a,_,_=self.store.snapshot(self.code,'host')
        b,seat,_=self.store.snapshot(self.code,'guest')
        self.assertEqual(a,b)
        self.assertEqual(seat,1)
        self.assertEqual(a['version'],1)

    def test_host_and_capacity(self):
        with self.assertRaises(GameError): self.store.action(self.code,'guest','start')
        with self.assertRaises(GameError): self.store.join(self.code,'third','Third')
        with self.assertRaises(GameError): self.store.snapshot(self.code,'intruder')

    def test_duplicate_roll_is_atomic(self):
        self.store.action(self.code,'host','start')
        def roll(_):
            try:
                self.store.action(self.code,'host','roll',0)
                return True
            except GameError: return False
        with ThreadPoolExecutor(4) as pool:
            self.assertEqual(sum(pool.map(roll,range(4))),1)
        self.assertEqual(self.store.snapshot(self.code,'host')[0]['version'],1)

    def test_no_rematch_mid_game(self):
        self.store.action(self.code,'host','start')
        with self.assertRaises(GameError): self.store.action(self.code,'host','restart')


if __name__=='__main__': unittest.main()
