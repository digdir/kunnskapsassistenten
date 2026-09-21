import { render } from 'preact';
import '@digdir/designsystemet-css';
import '@digdir/designsystemet-css/theme';
import '@digdir/designsystemet-web';
import './app.css';
import { App } from './App.tsx';
import { claimFragmentSession, installAuthRedirect, signedIn, toLogin } from './auth.ts';

installAuthRedirect();

await claimFragmentSession();

if (await signedIn()) {
  render(<App />, document.getElementById('root')!);
} else {
  toLogin();
}
