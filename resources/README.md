# Test fixtures

Files here exist to be *rejected* — they are the inputs for the upload step's
negative cases:

| File | What it exercises |
| --- | --- |
| `complaint.pdf` | wrong file type, rejected client-side with a toast |
| `InvalidFile.xlsx` | a workbook that is not the microplan template at all |
| `InvalidInputFile.xlsx` | the right shape, invalid content — rejected server-side |

There is deliberately no valid template here. The microplan template is generated
per campaign (it carries that campaign's boundaries and uuid), so the happy path
downloads the campaign's own template at runtime, fills it, and uploads it back —
see `src/utils/microplan-template.ts`.
