# CODENEX RAPID FIRE / QUIZ — TEAM AVERAGE SCORING & SPEED BONUS SPECIFICATION

**Document Version:** 1.0  
**Engine Authority:** Server-Authoritative (`server/src/services/scoringService.ts`)  
**Applicability:** CODENEX Rapid Fire (`RAPID_FIRE`) & Quiz (`QUIZ`) Game Modes

---

## 1. Product Philosophy & Team-First Scoring

CODENEX Rapid Fire & Quiz is a **team-first** competitive game.
- Every team member answers each question independently on their own terminal.
- A team's question score is the **arithmetic average** of all member scores for that question.
- **Team size does not multiply the score**:
  - 4-member team with all correct answers: $(10 + 10 + 10 + 10) / 4 = 10.0$ points
  - 2-member team with all correct answers: $(10 + 10) / 2 = 10.0$ points
  - 1-member team with correct answer: $10 / 1 = 10.0$ points
- This ensures small teams are never mathematically disadvantaged against larger teams.

---

## 2. No-Answer Rule & Stable Denominator

To prevent denominator manipulation (e.g. having weaker teammates disconnect, reload, or skip questions):
1. **Unanswered questions count as 0**: Any team member who does not submit an answer before the question deadline receives `0` points for that question.
2. **Denominator stability**: The scoring denominator is fixed to all non-banned team members registered in the session (`session.players.filter(p => p.teamId === team.id && p.status !== 'BANNED')`).
3. Disconnecting or missing players are **never** removed from the denominator during scoring.

### Example
Team of 4 members:
- Player A = 10 (correct)
- Player B = 10 (correct)
- Player C = 0 (unanswered / disconnected)
- Player D = 10 (correct)

$$\text{Team Base Score} = \frac{10 + 10 + 0 + 10}{4} = \frac{30}{4} = 7.5\text{ pts}$$

---

## 3. Question Points & Individual Scoring

Each question in the Game Builder has a configured base point value and time limit:
- `POINTS`: Base point value (e.g. `10 pts`).
- `TIME LIMIT`: Question duration in seconds (e.g. `30 sec`).

### Evaluation
- **Correct answer**: The member's submission is credited with the configured base points (e.g. `10`).
- **Incorrect answer**: `0` points.
- **Unanswered / Late**: `0` points.

---

## 4. Team Average Formula

For every question $q$:

$$\text{individualScore}(p, q) = \begin{cases} \text{points}(q) & \text{if } p \text{ submitted correct answer before deadline} \\ 0 & \text{otherwise} \end{cases}$$

$$\text{teamBaseScore}(T, q) = \text{roundScore}\left(\frac{\sum_{p \in T} \text{individualScore}(p, q)}{\max(|T|, 1)}\right)$$

Where $|T|$ is the total number of non-banned registered team members in the active session.

---

## 5. Team-Level Speed Bonus Formula

The Speed Bonus rewards teams for answering correctly earlier.

### Non-Summed Team Bonus Rule
To prevent larger teams from accumulating disproportionate bonus points, speed bonuses are **never** awarded individually and then summed. The speed bonus is calculated as a **single team-level bonus** per question:

$$\begin{matrix}
\text{Individual Answers} \\
\downarrow \\
\text{Individual Base Scores} \\
\downarrow \\
\text{Team Average Base Score} \\
\downarrow \\
\text{Team Speed Bonus } (X) \\
\downarrow \\
\text{Final Team Question Score} = \text{Base Average} + X
\end{matrix}$$

### Authoritative Implementation Formula
For each question $q$ with time limit $T_{ms}$ and bonus window $W_{ms}$ (defaults to $T_{ms}$):
1. If speed bonus is disabled (`speedBonus = false`): $X = 0$.
2. If no team member answered correctly ($|C| = 0$): $X = 0$.
3. If correct submissions $C$ exist from team members submitted before deadline ($0 \le \text{responseTime}(s) < W_{ms}$):
   - For each correct submission $s \in C$:
     $$\text{ratio}(s) = \max\left(0, \min\left(1, \frac{W_{ms} - \text{responseTime}(s)}{W_{ms}}\right)\right)$$
   - Average ratio across correct team responders:
     $$\bar{r} = \frac{1}{|C|} \sum_{s \in C} \text{ratio}(s)$$
   - Question team speed bonus:
     $$X = \text{roundScore}(M \times \bar{r})$$
     Where $M$ is the configured maximum speed bonus per question (`game.config.maxSpeedBonus`, defaults to $5$ or $\text{roundScore}(\text{points} \times 0.5)$).

### Example
- Question: 10 pts, 20 sec limit, max bonus $M = 5$.
- Team of 4:
  - Player A: Correct at 2 sec ($\text{ratio} = 18/20 = 0.9$)
  - Player B: Correct at 4 sec ($\text{ratio} = 16/20 = 0.8$)
  - Player C: Incorrect at 1 sec (not in $C$)
  - Player D: Correct at 6 sec ($\text{ratio} = 14/20 = 0.7$)
- Correct responders $C = \{A, B, D\}$, $|C| = 3$.
- $\bar{r} = (0.9 + 0.8 + 0.7) / 3 = 2.4 / 3 = 0.8$.
- Team Speed Bonus $X = \text{roundScore}(5 \times 0.8) = 4.0\text{ pts}$.
- Team Base Score $= (10 + 10 + 0 + 10) / 4 = 7.5\text{ pts}$.
- **Final Team Question Score** $= 7.5 + 4.0 = 11.5\text{ pts}$.

---

## 6. Deterministic Decimal Precision

Averages frequently generate decimal values (e.g. $30 / 4 = 7.5$, $20 / 3 = 6.666...$).
- Server, database, live scoreboard, and report exports consistently round values to **1 decimal place**:
  $$\text{roundScore}(v) = \frac{\text{Math.round}((v + \text{Number.EPSILON}) \times 10)}{10}$$
- Eliminates JavaScript IEEE 754 floating-point display artifacts (e.g. `7.5` instead of `7.5000000001`).

---

## 7. Game Snapshot Freeze

When a Game Master hosts a game (`POST /api/sessions`):
- The authoritative game configuration, challenges, options, answers, points, timers, and speed bonus settings are frozen into an immutable snapshot on `session.snapshot`.
- Live game execution, scoring, and deadline sweeps strictly reference the frozen snapshot.
- Any subsequent modifications made in the Game Builder while a session is live will **never** alter the active session's scoring or challenges.

---

## 8. Ranking & Tie-Breaking

Teams are sorted for the Live Scoreboard and Final Results using strict deterministic ordering:
1. Primary: Descending by `finalScore`.
2. Tie-break 1: Descending by `baseScore`.
3. Tie-break 2: Descending by `speedBonus`.

---

## 9. Security & Authority Model

- **Zero Trust Client**: Clients never calculate, transmit, or influence scores, timers, correctness, or speed bonuses.
- **Cutoff Enforcement**: Submissions with timestamps past `session.questionEndsAt` are rejected with HTTP 400.
- **Idempotency**: Duplicate submissions by a player on the same challenge and run are rejected or return the existing submission without mutating score.
- **Input Validation**: Malformed points, negative bonuses, NaN, and Infinity are sanitized and clamped to valid bounds.
- **Formula Injection Defense**: Spreadsheet export sanitizes cell values matching `^[=+@\-]` with leading single quotes.
