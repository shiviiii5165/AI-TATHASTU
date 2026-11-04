# Skill scoring model

Written for engineers and reviewers who need to understand or challenge a score. The code is `worker/intelligence/career_engine.py` (`ENGINE_VERSION = 1`) and `worker/intelligence/eris.py`.

**This model is not empirically calibrated.** No hiring or assessment outcomes are behind any weight, threshold or level. The scores are a consistent, explainable summary of evidence, not a measurement of ability. Don't describe them as accurate or validated.

## Proficiency

Proficiency is 0 to 100, or none ("Not assessed"). The points are added, then capped at 100.

| Input | Formula | Maximum |
|---|---|---|
| Repositories using the skill | `40 × min(1, repos / 5)` | 40 |
| Code volume (languages only) | `15 × min(1, log10(bytes) / 6)` | 15 |
| Recency | `(15 if last push ≤ 6 months, 7.5 if ≤ 18 months, else 0) × min(1, repos / 5)` | 15 |
| Described records, plus platform activity | `25 × min(1, records / 3)` | 25 |
| Certification | `+5`, only when another input already applies | 5 |
| Platform assessment | raises the score to `stars / 5 × 100` if that is higher | 100 |

Recency is rounded to one decimal place. A month is 30.4 days.

### Evidence quality rules

- **A skill-list mention earns nothing.** It sets the status to claimed and the score stays "Not assessed".
- **Certifications alone earn nothing.** They only add to other evidence.
- **Scores from the user's own descriptions are capped at 49.** That covers projects and jobs with no repository or platform behind them.
- **Repository metadata tops out at 70 (Proficient).** Source code isn't read, so Advanced also needs described work or an assessment.
- **GitHub topics count only if they name a skill in the catalogue.** Hyphens are normalised (`machine-learning`), and free-form tags (`awesome-list`) are ignored.
- **Each repository or record counts once per skill.**

### Status

| Status | Meaning |
|---|---|
| verified | Shown by a repository or by platform data we read directly |
| claimed | Only the user's resume or profile says so |
| inferred | A related skill suggests it. It never has a score, and is never inferred from a claim alone |

### Levels

| Score | Level |
|---|---|
| none | Not assessed |
| 0 to below 25 | Foundational |
| 25 to below 50 | Working |
| 50 to below 75 | Proficient |
| 75 and above | Advanced |

## Confidence

Confidence counts how many kinds of evidence exist: repositories, described records, platform activity, assessment, claim, certification.

| Kinds | 0 | 1 | 2 | 3 | 4 or more |
|---|---|---|---|---|---|
| Confidence | 0 | 0.35 | 0.6 | 0.8 | 0.9 |

It's capped at 0.35 unless a repository, platform result or assessment is involved. It's independent of proficiency.

## Role expectations

Role weights come from `ROLE_SKILLS` in `worker/intelligence/config.py`.

| Role weight | Expected score | Priority |
|---|---|---|
| 0.9 and above | 50 (Proficient) | High |
| 0.8 to below 0.9 | 25 (Working) | High |
| 0.6 to below 0.8 | 25 (Working) | Medium |
| below 0.6 | 10 (Foundational) | Low |

Coverage is the weighted share of a role's skills in the `met` state.

| Gap state | Meaning |
|---|---|
| met | Score is at or above expected |
| underdeveloped | Has a score, below expected |
| unverified | Claimed, nothing shows it |
| inferred | Only suggested by related skills |
| missing | No evidence of it |
| not_assessed | The user has no evidence base at all |

## ERIS (interview readiness)

ERIS takes every skill fact from the role analysis above, and adds two dimensions of its own.

```
technical       = Σ weight × min(1, proficiency / expected) / Σ weight     (no score counts as 0)
projects        = min(1, projects using a role skill / 3)
problem_solving = best of LeetCode (easy + 2·medium + 3·hard) / 400 and HackerRank stars / 5
score           = weighted mean of available components: technical 50%, projects 25%, problem_solving 25%
```

- A missing `problem_solving` is left out and the other weights are renormalised. It is never counted as 0.
- There is no score at all when the user has no evidence base, or when technical and projects are both 0 and there's no problem-solving data.
- ERIS gaps are the engine's top three open gaps, in the engine's order.

## Missing data

| Situation | Result |
|---|---|
| No evidence of any kind | Skills empty, role states `not_assessed`, no ERIS, no recommendations, no gaps claimed |
| Skill only listed | "Not assessed", status claimed |
| Role with no framework | Listed in `unsupportedRoles`, no invented gaps |
| LeetCode counts unknown | Treated as unknown, not 0 |
| No checked course for a skill | The recommendation says so. No title, price or duration is invented |

## What each kind of evidence can't show

| Evidence | Limitation |
|---|---|
| Resume only | Everything is self-reported. Listed skills get no score, and described ones stop at 49 |
| GitHub only | Metadata only: languages, sizes, topics, descriptions, dates. No code quality, authorship share, or review. Forks are excluded by the connector, but copied or vendored code still counts by size |
| Private work | Invisible. Experienced people with closed-source careers score low |
| Non-coding skills | Mostly reachable only through descriptions, so they usually stay at or below 49 |

## Synthetic evaluation

`worker/intelligence/evaluation.py` holds 15 synthetic profiles and 17 skill expectations across beginner, intermediate, experienced and conflicting evidence. Run it from `worker/` with `python -m intelligence.evaluation`. `worker/tests/test_scoring_evaluation.py` pins the result.

The expectations are one engineer's judgement, written before seeing the output. Here a "false positive" means the score is above that judgement, and a "false negative" means below it. The dataset is small and made up, so **these counts are not an accuracy rate.**

| Result | Count | Detail |
|---|---|---|
| As expected | 15 of 17 | |
| False positive | 1 | `topic_tagging/Kubernetes`: five tiny repositories that only tag a topic score 55 (Proficient), expected Foundational |
| False negative | 1 | `private_code_senior/Java`: years of private work score 25 (Working), expected Proficient or above |
| Role ranking | Consistent | Coverage: none 0, listed 0, beginner 0, intermediate 0.478, experienced 1.0 |

### Open questions for a product decision

No weights were changed in response to these. Any change should come with labelled outcomes, not just to make this table look better.

1. **Topic-only repositories** earn the full repository count and recency points, with no code volume behind them. Counting them for less would remove the false positive. It would also lower real framework use, which is often visible only through topics.
2. **Private-work careers** are capped by design, because nothing independent backs them. The UI says "claimed", which is honest but may discourage them. An assessment path would be the real fix.
3. **Confidence counts kinds of source, not amount.** A bare claim and eight large repositories both read 0.35, and a five-star assessment alone also reads 0.35. It should probably be reworked, or at least not shown for "Not assessed" skills.
4. **The beginner profile has 0 role coverage**, the same as one with only listed skills. Its Python score is real but below the role's expectation, so this is correct by the rules, though the coverage figure alone hides that progress.

## Changing the model

Bump `ENGINE_VERSION`, update this file and the pinned evaluation, and recompute users. Calibrating it needs real labels, such as interview outcomes or assessor ratings for consenting users.
