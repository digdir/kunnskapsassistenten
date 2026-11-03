

Usage Modes
├── Retrieval complexity
│   ├── Single-doc
│   │   ├── Simple QA (lookup)
│   │   ├── Extraction
│   │   ├── Summarization
│   │   └── Locate/cite
│   └── Multi-doc
│       ├── Aggregation (count, sum)
│       ├── Comparison
│       ├── Synthesis
│       ├── Temporal analysis
│       └── Cross-reference
│
├── Reasoning requirement
│   ├── None (pure retrieval)
│   ├── Light (inference)
│   ├── Medium (classification, analysis)
│   └── Heavy (gap analysis, recommendations)
│
└── Output format
    ├── Factoid
    ├── Prose
    ├── List
    └── Table/structured

## Usage Modes for RAG-systemer

### Single-document operations

| Mode          | Beskrivelse                         | Eksempel                                           |
| ------------- | ----------------------------------- | -------------------------------------------------- |
| Simple QA     | Finn ett faktum i ett dokument      | "Hva er budsjettet til Digdir i 2024?"             |
| Extraction    | Hent ut spesifikk informasjon/liste | "Hva er styringsparameterne i tildelingsbrevet?"   |
| Summarization | Oppsummer ett dokument              | "Gi et sammendrag av denne evalueringen"           |
| Locate        | Finn hvor noe står                  | "Hvor i instruksen står det om Digdirs myndighet?" |

### Multi-document operations

| Mode            | Beskrivelse               | Eksempel                                                        |
| --------------- | ------------------------- | --------------------------------------------------------------- |
| Aggregation     | Tell/summer på tvers      | "Hvor mange etater har fått merknad om internkontroll?"         |
| Comparison      | Sammenlign to+ dokumenter | "Sammenlign prioriteringene til Digdir og DFØ"                  |
| Synthesis       | Kombiner info til helhet  | "Hva vet vi om digitalisering i helsesektoren?"                 |
| Temporal        | Endring over tid          | "Hvordan har målene endret seg fra 2022 til 2024?"              |
| Cross-reference | Koble relatert info       | "Hvilke evalueringer finnes om ordninger nevnt i denne NOU-en?" |

### Reasoning operations

| Mode           | Beskrivelse              | Eksempel                                                 |
| -------------- | ------------------------ | -------------------------------------------------------- |
| Inference      | Trekk slutning fra fakta | "Tyder funnene på at reformen har virket?"               |
| Classification | Kategoriser funn         | "Hvilke utfordringer handler om økonomi vs. kompetanse?" |
| Gap analysis   | Identifiser mangler      | "Hva dekkes ikke av eksisterende veiledere?"             |

### Output complexity

| Mode    | Beskrivelse          | Eksempel                             |
| ------- | -------------------- | ------------------------------------ |
| Factoid | Ett ord/tall/setning | "Når ble instruksen sist oppdatert?" |
| Prose   | Sammenhengende tekst | "Forklar bakgrunnen for reformen"    |
| List    | Punktliste           | "List opp hovedanbefalingene"        |
| Table   | Strukturert tabell   | "Lag tabell over mål og resultater"  |

**Ide:** Spørring for å sjekke kapabiliteter/tilgang på data

### Oppsummering: Ressursbruk

| Usage Mode    | Syntetiser spørsmål | Syntetiser svar | Bruker-validering        | Chat-tråder         | Intervjuer             |
| ------------- | ------------------- | --------------- | ------------------------ | ------------------- | ---------------------- |
| Simple QA     | ✅                   | ✅               | Spot-check               | Formuleringer       | -                      |
| Extraction    | ✅                   | ✅               | Verifiser fullstendighet | Hva ekstraheres     | Behov                  |
| Summarization | ✅                   | ❌               | Score + kommentar        | Oppfølgingsspørsmål | Kvalitetskriterier     |
| Locate        | ✅                   | ✅               | -                        | -                   | -                      |
| Aggregation   | ⚠️                   | ❌               | Bygge fasit              | -                   | Aggregeringsbehov      |
| Comparison    | ⚠️                   | ❌               | Rubrikk-scoring          | Sammenlign-queries  | Dimensjoner            |
| Synthesis     | ❌                   | ❌               | Ekspert-scoring          | Temabehov           | Rubrikk                |
| Temporal      | ⚠️                   | ⚠️               | Verifisere               | -                   | Interessante endringer |

**Kolonneforklaring:**
- **Syntetiser spørsmål**: Om det er mulig å generere spørsmål automatisk (✅ = enkelt, ⚠️ = utfordrende, ❌ = vanskelig)
- **Syntetiser svar**: Om det er mulig å generere korrekte svar automatisk (✅ = enkelt, ⚠️ = krever validering, ❌ = upålitelig)
- **Bruker-validering**: Hvilken valideringsmetode som trengs fra brukere
- **Chat-tråder**: Hva som kan læres fra eksisterende brukersamtaler
- **Intervjuer**: Hva som bør kartlegges gjennom strukturerte brukerintervjuer

## Implementeringsstrategi

### Viktig: Ground Truth vs. RAG Output

**KRITISK:** Ground truth må være uavhengig av RAG-systemet for å evaluere hele systemet korrekt.

- ❌ **IKKE bruk**: `retrieval_context` fra RAG som fasit (evaluerer bare LLM, ikke retrieval)
- ✅ **BRUK**: Manuell validering eller full-dokument søk for ground truth

### Immediate Quick Wins (Low effort, high value)

| Usage Mode             | Estimat            | Tilnærming                                                                                                           | Ground Truth Strategi                                                       |
| ---------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Simple QA & Locate** | ~200-300 eksempler | • Klassifiser queries fra tråder<br>• Ekstraher spørsmål (IGNORER RAG-svar)<br>• Bygg ground truth uavhengig         | **Semi-auto**: RAG-svar som forslag → manuell validering (50/dag = 6 dager) |
| **Extraction**         | Varierer           | • Filtrer for liste/parameter-ekstraksjon<br>• Manuell ekstraksjon fra kildedokumenter<br>• Verifiser fullstendighet | **Manuell**: Person leser dokument og ekstraherer alle relevante items      |

**Alternative strategier for Simple QA:**

| Strategi           | Arbeid | Datamengde | Kvalitet | Beskrivelse                                             |
| ------------------ | ------ | ---------- | -------- | ------------------------------------------------------- |
| A) Full manuell    | Høy    | 200-300    | Høyest   | Person søker i dokumenter (Ctrl+F) og skriver svar      |
| B) Semi-automatisk | Medium | 200-300    | Høy      | Valider/korriger RAG-svar mot kildedokumenter           |
| C) Høy-konfidans   | Lav    | 50-100     | Medium   | Kun queries hvor retrieval score > 0.9 + spot-check 20% |

### Medium Effort, High Impact

| Usage Mode        | Estimat             | Tilnærming                                                                                                             | Ground Truth Strategi                                                            |
| ----------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Summarization** | 50-100 evalueringer | • Spørsmål fra tråder<br>• Bruk intervjufeedback til kvalitetsrubrikk<br>• Lag 3-5 nivå scoringssystem                 | **Rubrikk-basert**: Ekspertscoring med definerte kriterier                       |
| **Comparison**    | Varierer            | • Intervju brukere om relevante dimensjoner<br>• Bygg rubrikk basert på dette<br>• Finn sammenligningsqueries i tråder | **Rubrikk-basert**: Score på dimensjoner (fullstendighet, nøyaktighet, struktur) |

### To-delt Evaluering

For å isolere retrieval vs. generering:

| Eval Type           | Hva evalueres           | Format                                             |
| ------------------- | ----------------------- | -------------------------------------------------- |
| **End-to-end**      | RAG + LLM               | `{question, ground_truth_answer}`                  |
| **Generation only** | LLM (perfect retrieval) | `{question, correct_context, ground_truth_answer}` |
