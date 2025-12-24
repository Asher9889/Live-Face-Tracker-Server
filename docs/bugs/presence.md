# Present behaviour

| Current State | Intent       | Meaning                  |
| ------------- | ------------ | ------------------------ |
| OUT           | ENTER_INTENT | Valid entry attempt      |
| IN            | EXIT_INTENT  | Valid exit attempt       |
| IN            | ENTER_INTENT | Ignore (already inside)  |
| OUT           | EXIT_INTENT  | Ignore (already outside) |

```javascript
OUT + ENTRY camera  → mark IN
IN  + EXIT camera   → start exit flow
OUT + EXIT camera   → ignore
IN  + ENTRY camera  → ignore

```
