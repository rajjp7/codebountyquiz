# Round 2: The Non-Tech Round

> Solve. Unlock. Fight for power-ups that decide the next round.

Round 2 follows **Round 1 (Speedforces)**. It is a non-tech round of **3 questions** in **30 minutes**. Solving the first two questions unlocks power-ups. After submitting the round, you pick **2** unlocked power-ups to carry into the next round.

---

## Tracks

| Track | Who it's for | Difficulty |
|-------|--------------|------------|
| **Track 1** | First years | Easier questions |
| **Track 2** | All other years | Harder questions |

Both tracks follow the same format, rules and power-ups. Only the questions differ.

---

## Round Format

- **Questions:** 3
- **Time limit:** 30 minutes (one timer for the whole round)
- **Sequential unlocking:**
  - Only Question 1 is open at the start.
  - Question 2 opens only after you solve Question 1.
  - Question 3 opens only after you solve Question 2.
- You cannot skip ahead.

---

## Power-Up System

The first two questions unlock power-ups. You can see your unlocked power-ups on the website as soon as you earn them.

| Questions solved | Power-ups unlocked | Pool size |
|------------------|--------------------|-----------|
| 1 | Time Cracker, Topic Finder | **2** |
| 2 | + Penalty Sweeper, Jumper Points | **4** |
| 3 | No additional power-up; complete the round | **4** |

### Power-Up Details

#### Unlocked after Question 1

- **Time Cracker**: Deducts **20%** of your total time taken to solve a question.
- **Topic Finder**: Reveals the topic of the question, meaning the concept you need to use.

#### Unlocked after Question 2

- **Penalty Sweeper**: Removes **all penalties** on a question.
- **Jumper Points**: A multiplier power-up. The points for the question you select are multiplied by **1.5x**.

---

## Choosing Your Power-Ups

1. **Solve questions** during the 30 minutes to build your pool.
2. **Submit the round.** Selection opens after submission or when the timer expires.
3. **Open the power-up selection page.**
4. **Choose exactly 2 power-ups** from your pool.
5. **Confirm your choice.**

Key rules:

- You can choose only **2** power-ups, whatever your pool size.
- A bigger pool means more options, so solving more questions matters.
- Selection is done **only on the website** and **only after submitting the round**.

---

## Important: When Can You Use Them?

Power-ups **cannot be used in Round 2**. The 2 power-ups you choose are for use in the **next round**.

This round is about fighting for the right power-ups to carry forward.

---

## Quick Summary

| Item | Detail |
|------|--------|
| Position | After Round 1 (Speedforces) |
| Type | Non-tech |
| Questions | 3, unlocked one at a time |
| Time | 30 minutes |
| Tracks | Track 1 (first years), Track 2 (others) |
| Pool size | 0, 2 or 4, depending on questions solved |
| Power-ups you can pick | 2 |
| Selection | On the website, after round submission |
| Usable in | Next round only |

---

## Website Requirements (for the dev team)

- [ ] Two tracks, with participants assigned to Track 1 or Track 2.
- [ ] Sequential question unlocking: Q2 and Q3 stay locked until the previous question is solved.
- [ ] A single 30-minute round timer.
- [ ] A live "My Power-Ups" view showing the power-ups unlocked so far.
- [ ] Pool size logic: 1 solved gives 2, 2 solved gives 4, 3 solved gives 5.
- [ ] A power-up selection page that opens only after the round ends.
- [ ] Selection limited to exactly 2 power-ups from the participant's own pool.
- [ ] Choices locked after confirmation.
- [ ] **Admin: Excel export** of participants' power-up choices.

### Suggested Excel Export Columns

| Participant / Team | Track | Lab | Questions Solved | Pool Size | Power-Up 1 | Power-Up 2 |
|--------------------|-------|-----|------------------|-----------|------------|------------|
