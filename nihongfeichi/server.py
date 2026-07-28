#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
霓虹飞驰 Neon Rush 3D 后端服务器
- 静态文件服务（游戏本体）
- SQLite 数据库：历史成绩 + 成就
启动：python server.py  然后访问 http://localhost:8080
"""
import json
import os
import sqlite3
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, 'game.db')
PORT = 8080


def get_db():
    con = sqlite3.connect(DB)
    con.execute('''CREATE TABLE IF NOT EXISTS scores(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score INTEGER NOT NULL,
        gems INTEGER NOT NULL,
        distance INTEGER NOT NULL,
        created_at TEXT NOT NULL)''')
    con.execute('''CREATE TABLE IF NOT EXISTS achievements(
        id TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL)''')
    return con


def now():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ---------- 工具 ----------
    def _json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            return {}

    # ---------- 路由 ----------
    def do_GET(self):
        if self.path == '/api/scores':
            con = get_db()
            rows = con.execute(
                'SELECT id, score, gems, distance, created_at FROM scores ORDER BY id DESC LIMIT 50'
            ).fetchall()
            con.close()
            self._json({'scores': [
                {'id': r[0], 'score': r[1], 'gems': r[2], 'distance': r[3], 'time': r[4]}
                for r in rows
            ]})
        elif self.path == '/api/achievements':
            con = get_db()
            rows = con.execute('SELECT id, unlocked_at FROM achievements').fetchall()
            con.close()
            self._json({'achievements': {r[0]: r[1] for r in rows}})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/scores':
            d = self._body()
            con = get_db()
            con.execute(
                'INSERT INTO scores(score, gems, distance, created_at) VALUES(?,?,?,?)',
                (int(d.get('score', 0)), int(d.get('gems', 0)),
                 int(d.get('distance', 0)), now()))
            con.commit()
            con.close()
            self._json({'ok': True})
        elif self.path == '/api/achievements':
            d = self._body().get('unlocked', {})
            con = get_db()
            for k in d.keys():
                con.execute(
                    'INSERT OR IGNORE INTO achievements(id, unlocked_at) VALUES(?,?)',
                    (str(k), now()))
            con.commit()
            con.close()
            self._json({'ok': True})
        else:
            self._json({'error': 'not found'}, 404)

    def do_DELETE(self):
        if self.path == '/api/scores':
            con = get_db()
            con.execute('DELETE FROM scores')
            con.commit()
            con.close()
            self._json({'ok': True})
        elif self.path == '/api/achievements':
            con = get_db()
            con.execute('DELETE FROM achievements')
            con.commit()
            con.close()
            self._json({'ok': True})
        else:
            self._json({'error': 'not found'}, 404)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    get_db().close()
    print('霓虹飞驰服务器已启动: http://localhost:%d' % PORT)
    print('数据库文件: %s' % DB)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
