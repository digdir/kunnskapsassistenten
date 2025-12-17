
| **Relatert til** |             |
| ---------------- | ----------- |
| **Status**       | not started |
## Linker til arbeid

- [Eksempel på hvordan filteret kan brukes (i figma)](https://www.figma.com/design/dD3Xs8rJe1TYU5fb65VKEY/Kunnskapsassistenten?node-id=1083-28727&t=4AJfWvXcDmz9BIfr-11) i sammenheng med [dokumentvisning](dokumentvisning.md)
- [Link til arbeidet i Figma](https://www.figma.com/design/dD3Xs8rJe1TYU5fb65VKEY/Kunnskapsassistenten?node-id=1041-12633&p=f&t=4AJfWvXcDmz9BIfr-11)

## Formål

Tilrettelegge for at filteret kan skalere, med f. eks valg av år eller departement, uten at det skaper utfordringer for brukeropplevelsen på ulike skjermstørrelser. Dette vil også være mer tilnærmet likt som filteret i Kudos-databasen, som brukerne våre er kjent med fra før.

## Bakgrunnen

### Hvorfor horisontal filtrering ikke fungerer i lengden

Når du velger mange filtre påvirker det hvordan layouten ser ut. Enten plasserer vi nedtrekksmenyene på linje, med de såkalte “chipsene” over, som da skaper mye luft over alt innholdet. Eller så plasserer vi overskriftene på linje som fører til at nedtrekksmenyene forskyves ujevnt nedover layouten.

Når vi får filtrering på årstall på plass vil vi møte på et annet problem. For hvis Kunnskapsassistenten brukes på mindre skjermer må filteret dermed stables i høyden, når det ikke er mer bredde å hente. I så fall virker filtreringen rotete, og dytter alt innholdet såpass langt ned på sida at du må scrolle for å få med deg noe som helst.

![](../images/Pasted%20image%2020251215093028.png)
![](../images/Pasted%20image%2020251215093045.png)
![](../images/Pasted%20image%2020251215093054.png)

Når vi får filtrering på årstall på plass vil vi møte på et annet problem. For hvis Kunnskapsassistenten brukes på mindre skjermer må filteret dermed stables i høyden, når det ikke er mer bredde å hente. I så fall virker filtreringen rotete, og dytter alt innholdet såpass langt ned på sida at du må scrolle for å få med deg noe som helst.

---
## Løsningen

![](../images/Pasted%20image%2020251215093426.png)

![](../images/Pasted%20image%2020251215093412.png)

## Bør utforskes videre

- Noen brukere har behov for å skille departement og virksomhet i større grad, eller velge alle virksomheter innen et departement
    - Kan være relevant å filtrere på departement
