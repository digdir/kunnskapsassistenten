# Run Kunnskapsassistenten locally

This is how you get the app running on your own machine, against the shared
test backend and Typesense, with real answers and real filters. The guide is
for you if you are not a developer and have Claude Code to help. Each step is
one command or one action, and below it is what you should see when it has
worked. The commands are typed in Terminal on a Mac.

## 1. Git and Node 24

```sh
git --version
```

You should see `git version` and a number. If the Mac offers to install
developer tools, say yes, wait until it is done and run the command again.

Node is installed with nvm:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Close Terminal and open it again, so it finds nvm. Then:

```sh
nvm install 24
node --version
```

The last one should print `v24` and more, for example `v24.21.0`.

## 2. The code

```sh
git clone https://github.com/digdir/kunnskapsassistenten.git
cd kunnskapsassistenten/src
npm ci
```

`npm ci` takes a minute or two and ends with `added` and a number of packages.
Warnings about `install-scripts` at the end are expected. All the commands
from here on are run in `src/`.

## 3. The keys

```sh
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` in a text editor. Everything is filled in except
two lines:

- `KA_API_KEY=`: the key to the backend at `test.rag.digdir.cloud`. It only
  allows asking questions.
- `TYPESENSE_API_KEY=`: the search key to Typesense, which gives the filters
  and the excerpts in the sources.

Ask the team for both. They are shared in the password manager, never in chat
or email. Paste them right after `=`, with no spaces, and not into Claude Code
either. `.env.local` is kept out of git and must never be committed.

## 4. Start the app

```sh
npm run web
```

After a few seconds it says `Local:   http://localhost:5173/`. Open that
address in the browser. If there is a line that starts with
`[ka] Live mangler`, see step 5 first.

Ask a question, for example «Hva skriver Statens vegvesen om
trafikksikkerhet i årsrapporten for 2024?». A real answer looks like this:
first «Fremgangsmåte» shows while the app searches, then the answer comes with
small numbers such as [1] and [2] that point to the sources, and below the
answer «Kilder brukt i svaret» with documents from Kudos. The filter panel has
Dokumenttyper, Virksomheter and År.

Stop the app with Ctrl+C in Terminal. If 5173 is taken, it picks the next free
port and prints it. To choose another port, use `npm run web -- --port 5180`.

## 5. When it fails

After every change to `.env.local`, stop the app with Ctrl+C and start it
again with `npm run web`. It reads the file only when it starts.

| You see                                                    | It means                                                          | Do this                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `[ka] Live mangler` and some names, in Terminal            | Those lines are empty in `.env.local`                             | Fill in the lines it names                                                                                                      |
| «Oppsettet mangler» in the app                             | `KA_API_URL` is missing from `.env.local`                         | Copy `.env.example` again (step 3), and paste the keys in again                                                                 |
| «Ingen tilgang» when you ask                               | The backend refused `KA_API_KEY`                                  | Check that the key is the one for `test.rag.digdir.cloud`, and that all of it is there, with no spaces                          |
| «Filtrering er ikke tilgjengelig ennå» in the filter panel | Typesense did not accept the key, or did not find the collections | Check `TYPESENSE_API_KEY`, and that `TYPESENSE_URL`, `KA_FACET_COLLECTIONS` and `KA_CHUNK_COLLECTIONS` are as in `.env.example` |
| «Svaret kom ikke fram» when you ask                        | The backend answered with an error                                | Tell the team, with the time                                                                                                    |

## 6. Working with Claude Code

Start Claude Code in `src/`:

```sh
claude
```

Ask it to read `apps/web/CLAUDE.md` first. That is where the rules for the code
are, and where things are. Then, one thing at a time:

1. Ask for a branch of its own for the change before anything is changed,
   never `main`.
2. Describe the change, and look at it in the browser while `npm run web` runs.
3. Ask Claude Code to run the checks listed in `CLAUDE.md`, and to open a
   draft PR against `main` with a short description in English. You get the
   link to the PR back.
4. Someone on the team reviews the PR and merges it.
