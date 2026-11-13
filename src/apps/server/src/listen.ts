/** Where the server listens: `LISTEN_HOST` if set, else only this machine while sign-in is off. */
export function listenHost(signIn: boolean, env: NodeJS.ProcessEnv = process.env) {
  const asked = (env.LISTEN_HOST ?? '').trim();
  if (asked) return asked;
  return signIn ? undefined : '127.0.0.1';
}
