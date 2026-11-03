# Kunnskapsassistenten

| Folder | Contents |
| --- | --- |
| [`src/`](src/) | The application: frontend, server and contract, built on `digdir-headless-rag`. See [`src/README.md`](src/README.md). |
| [`docs/`](docs/) | Documentation of the design work. |
| [`docs/archive/evals/`](docs/archive/evals/) | The evaluation code from the headless-rag period, kept as documentation. Not run and not maintained. |

## Documentation of the design work

This is where we collect everything we have looked into and learned while working on
Kunnskapsassistenten.

It is spread across four main folders:

1. Felles forståelse (shared understanding)
2. Innsikt (insight)
3. Eksisterende funksjonalitet (existing functionality)
4. Ny funksjonalitet (new functionality)

### Felles forståelse

What is the difference between the staging environment and the test environment? The answer is in
[utviklingsmiljøer](docs/felles%20forst%C3%A5else/utviklingsmilj%C3%B8er.md).

With a small team of 7 people across 3.5 full-time equivalents, it matters all the more that we
agree on what is to be built *now* and what will be useful to the user *later on*. So we have
explored [versjonering av Kunnskapsassistenten](docs/felles%20forst%C3%A5else/versjonering%20av%20Kunnskapsassistenten.md),
and what it means in practice for the way we plan across disciplines.

How do we know we are making the right choices for the users? Besides testing and talking to them
regularly, we have also written down some
[retningslinjer for bruk av Kunnskapsassistenten](docs/felles%20forst%C3%A5else/retningslinjer%20for%20bruk%20av%20Kunnskapsassistenten.md).
From those in turn we have made [akseptansekriterier](docs/felles%20forst%C3%A5else/akseptansekriterier.md)
for testing new functionality.

We do not follow either the guidelines or the acceptance criteria slavishly, but they are something
to aim for in a working day with a high tempo.

In other words, this folder holds the knowledge the project as a whole needs.

### Innsikt

[What do our users think of the document view](docs/ny%20funksjonalitet/dokumentvisning.md)? The
answer is in this folder.

What do we actually know about our users, taking a broader view? The answer is in
[personas](docs/innsikt/personas.md).

What is meant by an «ambitious request», and why does it matter so much?
[The answer is here](docs/innsikt/fullstendige%20oversikter.md).

### Eksisterende funksjonalitet

With our small team we have got a lot in place in a short time, but there is still plenty of room
for improvement. That kind of thing is in this folder.

### Ny funksjonalitet

Everything we have had to put on hold, for one reason or another, is here. Some of it comes from
suggestions users mentioned in an interview. Other things have been tried from a design point of
view, either as a prototype (such as [notater](docs/ny%20funksjonalitet/notater.md)) or as still
sketches (such as [testing av dokumentvisning](docs/innsikt/testing%20av%20dokumentvisning.md)),
but not prioritised for development just yet.
