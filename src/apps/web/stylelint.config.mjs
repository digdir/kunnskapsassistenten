/**
 * En linter som sier fra om CSS nettleserne våre ikke støtter.
 *
 * Bedt om av Lars 23.09: «line-clamp fungerer ikke … kanskje du skal
 * installere en slags linter som forteller deg sånt, så du slipper å sjekke
 * selv.» Det er den jobben denne fila har, og ikke noe annet: her er ingen
 * stilregler, ingen sortering og ingen meninger om navn. Designsystemet
 * bestemmer hvordan CSS-en vår ser ut, og en linter som også hadde en mening
 * om det ville brukt tiden sin på å krangle med den.
 *
 * `stylelint-browser-compat` og ikke `stylelint-no-unsupported-browser-
 * features`, målt mot begge på vår egen CSS 23.09:
 *
 * | | caniuse-baserte | MDN-baserte (valgt) |
 * | --- | --- | --- |
 * | uprefikset `line-clamp` | ikke flagget | flagget |
 * | treff på `src/**` | 6, hvorav 4 er støy | 5, alle ekte |
 * | oppløsning | per caniuse-«feature» | per egenskap, med lenke |
 *
 * Den caniuse-baserte melder «multicolumn er bare delvis støttet» tre steder
 * og «css3-cursors» på en `cursor`, som ingen kan gjøre noe med og ingen
 * skal gjøre noe med. Den MDN-baserte sier hvilken egenskap i hvilken
 * nettleser.
 *
 * Tallene er målt mot nettleserlista som gjaldt da, og lista er siden blitt
 * videre (`.browserslistrc`). Det som avgjorde valget henger ikke på lista:
 * den caniuse-baserte flagger ikke uprefikset `line-clamp` uansett hvilke
 * nettlesere man peker på, fordi den ikke ser prefikset i det hele tatt.
 */
export default {
  plugins: ['stylelint-browser-compat'],
  rules: {
    'plugin/browser-compat': [
      true,
      {
        /*
         * Her ligger hele poenget.
         *
         * MDN fører `line-clamp` som støttet fra Chrome 6 og Safari 5 — MED
         * `-webkit-`-prefiks, i hver eneste motor. Med `prefix: true`, som er
         * standarden, teller det som støtte, og da tier linteren om nøyaktig
         * den skrivemåten Lars så ikke virket. Med `false` teller en
         * prefikset oppføring ikke som støtte for den uprefiksede
         * egenskapen, og da sies det fra.
         *
         * Prisen er at en bevisst prefikset linje også må sies fra om. Det er
         * fire linjer i hele kodebasen i dag, hver med en `stylelint-disable`
         * og en grunn ved siden av — som er billigere enn å ikke få vite det
         * neste gang.
         */
        allow: { prefix: false },
      },
    ],
  },
};
