// 비밀번호 해시 — scrypt(node:crypto). 의존성 없이 쓸 수 있는 것 중 제일 낫다.
//
// auth.ts에 안 넣은 이유: auth.ts는 미들웨어(edge)에서도 도는데 node:crypto는
// edge 번들에 못 들어간다. 해시는 로그인·가입 라우트(nodejs)에서만 필요하다.
import { randomBytes, scrypt, timingSafeEqual as tse } from "node:crypto";

const KEY_LEN = 32;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** `saltHex:hashHex` 한 줄로 저장한다 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return key.length === expected.length && tse(key, expected);
}
