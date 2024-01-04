import * as argon2 from 'argon2';
import { query } from '../utils/db';
import jsonwebtoken from 'jsonwebtoken';

export class User {
  id: number;
  name: string;
  hash: string;
  created: Date;

  constructor(id: number, username: string, hash: string, created: Date) {
    this.id = id;
    this.name = username;
    this.hash = hash;
    this.created = created;
  }

  async verifyPassword(password: string) {
    return await argon2.verify(this.hash, password);
  }
}

export async function createUser(username: string, password: string) {
  const hash = await argon2.hash(password);
  try {
    const result = await query(
      'INSERT INTO users (name, password) VALUES($1, $2) RETURNING id, created',
      [username, hash],
    );
    return new User(result.rows[0].id, username, hash, result.rows[0].created);
  } catch (e) {
    console.log(e);
  }
}

export async function getUser(username: string) {
  try {
    const result = await query('SELECT * FROM users WHERE name = $1', [
      username,
    ]);
    return new User(
      result.rows[0].id,
      result.rows[0].name,
      result.rows[0].password,
      result.rows[0].created,
    );
  } catch (e) {
    console.log(e);
  }
}

export async function getUserById(id: number) {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return new User(
      result.rows[0].id,
      result.rows[0].name,
      result.rows[0].password,
      result.rows[0].created,
    );
  } catch (e) {
    console.log(e);
    return null;
  }
}

export async function getUserFromToken(token: string) {
  if (!process.env.AUTH_SECRET) console.log('AUTH_SECRET is not set');
  const decoded: any = jsonwebtoken.verify(
    token,
    process.env.AUTH_SECRET || 'secret',
  );
  return await getUserById(decoded.id);
}
