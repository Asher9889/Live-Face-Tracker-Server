# Face Recognition System — Unknown Identity Merge Roadmap

---

## 🧱 Phase 1 — Core Merge Infrastructure

### ✅ Backend (Node)

* [ ] Create API: `POST /unknown/merge`
* [ ] Accept payload:

  ```json
  {
    "sourceIds": ["id1", "id2"]
  }
  ```
* [ ] Fetch identities from DB
* [ ] Validate:

  * [ ] Ensure all IDs exist
  * [ ] Prevent merging single identity
* [ ] Compute cosine similarity between identities

  * [ ] Reject if similarity < 0.6
* [ ] Call FastAPI merge service
* [ ] Update primary identity:

  * [ ] `meanEmbedding`
  * [ ] `embeddingCount`
  * [ ] `lastSeen`
* [ ] Reassign events:

  * [ ] Update `UnknownEvent.identityId`
* [ ] Delete duplicate identities
* [ ] Return merged identity response

---

### 🧠 FastAPI (AI Layer)

* [ ] Create endpoint: `POST /ai/merge`
* [ ] Input:

  ```json
  {
    "embeddings": [...],
    "counts": [...]
  }
  ```
* [ ] Implement merge logic:

  * [ ] Weighted mean:

    ```python
    merged = (E * counts[:, None]).sum(axis=0) / sum(counts)
    ```
  * [ ] Normalize vector
* [ ] Return:

  ```json
  {
    "mergedEmbedding": [...],
    "totalCount": number
  }
  ```

---

## 🔁 Phase 2 — AI Memory Sync (CRITICAL)

* [ ] Add endpoint: `POST /ai/reload`
* [ ] Reload all unknown identities from DB
* [ ] Rebuild:

  * [ ] `self.embeddings`
  * [ ] `self.unknown_ids`
  * [ ] `self.counts`
* [ ] Trigger reload after merge from Node

---

## 🖥️ Phase 3 — UI Integration

* [ ] Display unknown identities list
* [ ] Show:

  * [ ] Representative image
  * [ ] First seen / last seen
  * [ ] Embedding count
* [ ] Allow multi-select identities
* [ ] Add button: **Merge**
* [ ] Call `/unknown/merge`
* [ ] Refresh UI after merge

---

## 🔍 Phase 4 — Validation & Safety

* [ ] Prevent bad merges:

  * [ ] Similarity threshold check (> 0.6)
  * [ ] Minimum embedding count check (> 2)
* [ ] Optional:

  * [ ] Show similarity score in UI before merge
* [ ] Log all merge actions (audit trail)

---

## 🧠 Phase 5 — Matching Improvements (HIGH IMPACT)

* [ ] Store additional embeddings per identity (top K = 2–3)
* [ ] Modify matching logic:

  ```python
  similarity = max(
      cosine(query, centroid),
      cosine(query, stored_embeddings)
  )
  ```
* [ ] Improve face quality filtering:

  * [ ] blur threshold
  * [ ] yaw/pitch/roll stricter
* [ ] Add embedding consistency check before buffer insert

---

## 🔁 Phase 6 — Duplicate Reduction (IMPORTANT)

* [ ] Improve buffer logic:

  * [ ] Reject embeddings far from buffer centroid
* [ ] Increase `MIN_UNKNOWN_FRAMES`
* [ ] Add sliding window buffer control
* [ ] Ensure only high-quality frames enter centroid computation

---

## 🧬 Phase 7 — Auto Merge Suggestions (Optional)

* [ ] Background job:

  * [ ] Compare unknown identities pairwise
* [ ] If similarity > 0.65:

  * [ ] Mark as "Suggested Merge"
* [ ] Show suggestions in UI

---

## 👤 Phase 8 — Convert Unknown → Known

* [ ] Add API: `POST /unknown/convert`
* [ ] Input:

  ```json
  {
    "unknownId": "...",
    "employeeId": "..."
  }
  ```
* [ ] Move embedding to employee collection
* [ ] Reassign events
* [ ] Remove unknown identity

---

## 📊 Phase 9 — Observability & Debugging

* [ ] Log:

  * [ ] merge operations
  * [ ] similarity scores
  * [ ] match confidence
* [ ] Track:

  * [ ] duplicate rate
  * [ ] merge frequency
* [ ] Add debug view for embeddings (optional)

---

## ⚠️ Critical Rules (DO NOT IGNORE)

* [ ] Always normalize embeddings after merge
* [ ] Never merge without similarity validation
* [ ] Always sync AI memory after DB changes
* [ ] Do NOT rely only on centroid for matching (add top embeddings later)

---

## 🚀 Future Enhancements

* [ ] Identity clustering (DB-level)
* [ ] Multi-camera identity linking
* [ ] Temporal tracking across cameras
* [ ] Confidence scoring system

---

## 🧠 Final Architecture Summary

```text
Camera → AI Worker → Unknown Identity
                         ↓
                    Node API
                         ↓
                     MongoDB
                         ↓
                   FastAPI (merge/math)
                         ↓
                  AI Memory Reload
                         ↓
                  Improved Matching
```

---

# Camera Behaviour
| Role        | Responsibility                    |
| ----------- | --------------------------------- |
| **REGISTER**   | create unknown                    |
| **ASSIST**  | help improve/update unknown       |
| **OBSERVE** | only track (no identity creation) |

