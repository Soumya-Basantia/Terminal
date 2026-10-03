# THE WITNESS — LIVE HUMAN PLAYTEST CHECKLIST

> **Status:** READY FOR HUMAN PLAYTEST  
> **Target Audience:** First- and second-year college CS students (no prior knowledge of binary search or information theory required).  
> **Platform Engine:** TERMINAL Unified Game Platform (Solo Vertical Slice).  

---

## Pre-Playtest Setup Verification

Before seating a student, verify:
1. TERMINAL server running on `http://localhost:3001` (or local staging host).
2. Game Master created an Event with a `THE_WITNESS` Game ("Operation Blackout") and started the session.
3. Student workstation opened to `http://localhost:5173/join` (or Stage view on projector `http://localhost:5173/stage/:roomCode`).
4. Room Code displayed clearly on screen.

---

## 1. 5-Minute Solo Test (Quick Evaluation)

- **Purpose:** Test whether a student can complete a rapid investigation without coaching.
- **WHAT THE PLAYER SHOULD DO:**
  1. Join the room code from their laptop.
  2. Read the 30-second Field Manual walkthrough when the game launches.
  3. Formulate and dispatch 2–3 balanced questions using the Question Builder.
  4. Observe suspect eliminations on the Evidence Board.
  5. Click **FINAL ACCUSATION** once down to 1–2 suspects and select the prime suspect.
- **WHAT WE EXPECT:**
  - Onboarding completed in under 30 seconds.
  - Student uses the live **Partition Preview** (`YES: 4 | NO: 4`) to guide their choices.
  - Evidence response arrives with clear affirmative/negative feedback.
  - Final accusation filed within 3 to 5 minutes with a positive score ($> 100$ pts).
  - Post-game "WHAT YOU JUST DID" debrief modal appears upon completion.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student asks "How do I type a question?" (indicates failure to notice slot controls).
  - Student ignores the Partition Preview entirely and makes random single-name queries.
  - Student is confused about why suspects were grayed out / stamped EXONERATED.
  - Student hesitates to accuse when $N=1$ suspect remains.

---

## 2. 10-Minute Full Investigation Test

- **Purpose:** Test deep reasoning, candidate note inspection, and deliberative strategy.
- **WHAT THE PLAYER SHOULD DO:**
  1. Review the Case Dossier and click on individual suspect cards to read their roles, locations, and clearance levels.
  2. Plan a multi-step inquiry path (e.g. Clearance $\ge 3 \rightarrow$ Subnet BETA $\rightarrow$ Hardware Token).
  3. Deliberately check the Interrogation Log history before dispatching each inquiry.
  4. Submit the formal indictment when deduction is ironclad.
- **WHAT WE EXPECT:**
  - Student stays engaged without cognitive fatigue.
  - Interrogation log acts as an external memory aid so the student never needs scratch paper.
  - Student finishes with 2–3 question tokens remaining, securing the Grand Detective efficiency bonus.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student loses track of why a suspect was eliminated.
  - Interrogation log overflows or becomes illegible.
  - Student feels rushed by uncommunicated timers.

---

## 3. Beginner Test (No Prior CS Knowledge)

- **Purpose:** Verify that a student with zero algorithms background intuitively understands the mechanic.
- **WHAT THE PLAYER SHOULD DO:**
  1. Read the 30-second onboarding briefing.
  2. Explore the Question Builder dropdowns without guidance.
  3. Formulate questions based purely on common sense.
- **WHAT WE EXPECT:**
  - Student grasps that question tokens are scarce (`QUESTIONS REMAINING: 5`).
  - Student notices that a 4:4 split eliminates more suspects than a 1:7 split.
  - Student naturally achieves the "Aha!" moment: *"Splitting the group in half is faster than asking about one person."*
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student asks for definitions of technical terms (the UI must have zero algorithmic jargon).
  - Student feels punished or confused by negative answers (*"NO"* means innocent, not game over).
  - Onboarding takes longer than 45 seconds to digest.

---

## 4. Experienced Student Test (Algorithmic Intuition)

- **Purpose:** Verify that CS students with search/tree knowledge find the mechanic satisfying rather than trivial.
- **WHAT THE PLAYER SHOULD DO:**
  1. Skip or quickly scan the onboarding.
  2. Aim for the mathematically minimal path ($O(\log_2 N)$ steps).
  3. Achieve the maximum score efficiency bonus (175 points).
- **WHAT WE EXPECT:**
  - Student immediately seeks $N/2$ splits using the Partition Preview.
  - Student isolates culprit Priya Nair in exactly 2 or 3 inquiries.
  - Student appreciates the post-game "WHAT YOU JUST DID" validation connecting their play to binary search and information gain.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student finds no attributes that yield near-equal partitions.
  - Scoring fails to reward optimal search behavior over brute force.

---

## 5. Incorrect-Question Test (Suboptimal Query Handling)

- **Purpose:** Test how gracefully the system handles poor inquiries and whether the student can recover.
- **WHAT THE PLAYER SHOULD DO:**
  1. Deliberately dispatch an unbalanced inquiry: `[Authentication Method] [ == ] [ VPN_CERT ]` (1 vs 7 split).
  2. Observe that only 1 suspect is eliminated.
  3. Attempt to recover with their remaining 4 questions.
- **WHAT WE EXPECT:**
  - Evidence text clearly explains: *"NEGATIVE — 1 suspect exonerated."*
  - The Question Budget visibly decrements from 5 to 4.
  - Surviving 7 suspects remain active and interactive.
  - Student realizes the wastefulness of narrow inquiries and pivots to broader attribute filters.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student assumes the game is broken or bugged because only 1 suspect was grayed out.
  - Student gets stuck in an unrecoverable dead end without visual cues on remaining options.

---

## 6. Zero-Budget Exhaustion Test (Edge Case)

- **Purpose:** Verify the game experience when the player runs completely out of question tokens.
- **WHAT THE PLAYER SHOULD DO:**
  1. Dispatch 5 consecutive questions until `QUESTIONS REMAINING: 0`.
  2. Attempt to dispatch a 6th question.
  3. Make a final accusation with 0 tokens left.
- **WHAT WE EXPECT:**
  - The Question Builder disables dispatch and displays a clear warning: *"Question budget exhausted."*
  - The **FINAL ACCUSATION** button remains prominently enabled and accessible.
  - The player can still review the entire Evidence Board and indict their best candidate.
  - A correct accusation still succeeds and awards base points (without conservation bonus).
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Student is locked out of making an accusation when budget hits 0.
  - Accusation modal fails to open or crashes.
  - No visual feedback explaining why new questions cannot be asked.

---

## 7. Incorrect-Accusation Test (False Indictment)

- **Purpose:** Test user feedback and penalty handling when the player indicts the wrong suspect.
- **WHAT THE PLAYER SHOULD DO:**
  1. Ask 1 question.
  2. Open the Final Accusation modal.
  3. Deliberately accuse an innocent suspect (e.g. S1 Devon Reed or S2 Elena Mercer).
- **WHAT WE EXPECT:**
  - Server denies the warrant: *"ACCUSATION FAILED — Evidence contradicts suspect."*
  - Player receives 0 points for the failed indictment.
  - Player is informed of the failure without crashing or corrupting their session state.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Modal stays open or freezes in a loading spinner.
  - Ambiguous feedback leaves student unsure if the accusation succeeded or failed.

---

## 8. Reconnect Test (Network Resilience)

- **Purpose:** Test that an unexpected browser refresh or disconnect does not destroy investigation progress.
- **WHAT THE PLAYER SHOULD DO:**
  1. Join case, ask 2 questions, and eliminate 4 suspects.
  2. Hard refresh the browser (`Ctrl+F5` or `Cmd+Shift+R`) or close and reopen the tab.
- **WHAT WE EXPECT:**
  - Client reconnects seamlessly to the active room.
  - `GET /witness-state` restores the exact question budget, all eliminated suspects, and the complete interrogation log.
  - No duplicate question tokens are deducted.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - Questions budget resets back to 5.
  - Previously eliminated suspects reappear as active.
  - Interrogation log is blank after refresh.

---

## 9. Stage / Spectator Test (Audience Experience)

- **Purpose:** Verify that a live audience watching the projector screen can follow the investigation drama.
- **WHAT THE PLAYER / GM SHOULD DO:**
  1. Project `http://localhost:5173/stage/:roomCode` on a secondary display.
  2. Have the student play on their laptop.
  3. Observe the Stage view during inquiries and final accusation.
- **WHAT WE EXPECT:**
  - Audience sees the case file name, total suspects (8), and live active vs. eliminated counters.
  - Recent testimonies appear on stage in real-time (e.g., *"Detective Alice exonerated 4 suspects"*).
  - **Zero Spoilers:** The Stage NEVER reveals who the secret culprit is while the round is active.
- **WHAT WOULD INDICATE A UX PROBLEM:**
  - The Stage leaks the culprit ID or secret answer.
  - The Stage text is too small to read from 10 feet away.
  - Spectators cannot tell who is winning or making progress.

---

## Summary Status

- **Automated QA:** All 20 tests in `test_the_witness.js` passed.
- **Regression Suite:** All 8 existing game suites passed with 0 regressions.
- **Build Quality:** TypeScript and Vite bundle compiled cleanly with 0 errors.
- **Playtest Readiness:** **READY FOR HUMAN PLAYTEST**
