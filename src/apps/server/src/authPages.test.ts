import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { entraLoginPage } from './authPages.ts';

describe('entraLoginPage', () => {
  test('the button starts the Microsoft sign-in and keeps the return path', () => {
    assert.match(entraLoginPage('/chat/abc'), /href="\/auth\/start\?next=%2Fchat%2Fabc"/);
  });

  test('the return path cannot break out of the link', () => {
    const html = entraLoginPage('/"><script>alert(1)</script>');
    assert.ok(!html.includes('<script>alert(1)'));
  });

  test('an error is shown escaped', () => {
    assert.ok(entraLoginPage('/', 'Feil <b>her</b>').includes('&lt;b&gt;'));
  });

  test('the page carries no inline script for a CSP to allow', () => {
    assert.ok(!/<script(?![^>]*\bsrc=)/.test(entraLoginPage('/', 'x')));
  });
});
