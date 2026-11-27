# Research opportunities audit — 2026-11-27

Scope: every `opportunities` row with `type = 'research'` and `status = 'active'` (83 rows), read with a READ ONLY
transaction from the database `.env.local` points to. **No data was changed.** Proposed changes are in
`research-opportunities-audit-2026-11-27.sql` and need explicit approval before anyone runs them.

Catalogue at audit time: active 83 · expired 66 · unverified 35 · withdrawn 13.

## Method

Each listing's official page was fetched on 2026-11-27 (IIT Hyderabad careers page, IIT Kharagpur SRIC advert pages,
IIT Roorkee Project Jobs page, IISc careers page, mpg.de job board, HZDR, MPI-CBG). Many official PDFs could not be read
as text; where that happened the deadline comes from the institution's own listing row, never from a guess.

## Results

| Group | Rows | Verdict |
|---|---|---|
| IIT Kharagpur SRIC | 22 | All 22 advert pages exist; every stated last date is today or later. Keep. |
| IIT Hyderabad | 24 | All 24 still listed on iith.ac.in/careers. Keep. 9 are 2025 adverts marked "Rolling" by IITH itself (see Review). |
| IIT Roorkee | 7 | 6 listed on the official Project Jobs page and open. 1 (Project Assistant, walk-in 26 Nov) has passed; already hidden by the deadline gate. |
| IISc | 1 | PDF exists but is **not** on iisc.ac.in/careers and its text was unreadable. Review. |
| Max Planck Society | 24 | 16 confirmed advertised; 1 removed at source; 7 could not be fetched. |
| HZDR | 3 | All advertised. |
| MPI-CBG | 2 | Standing programme pages dated 2024, no open call shown. Review. |

Duplicates: no repeated URLs. Same-title rows at IIT KGP / IIT Roorkee are separate adverts with separate reference
numbers, except possibly the two IIT Roorkee Earth Sciences JRF PDFs (`ES/2026/adv021120261.pdf`, `ES/2026/adv02112026.pdf`):
identical listing text, different files. Likely one advert uploaded twice; not confirmed.

Non-research roles: "Animal Welfare Officer" (mpg.de 27075180) is active in the table but already excluded from every
user-facing list by the listing intelligence (`insight.ts` → `non_research`).

### Remove from active display (proposed)

| Listing | Reason |
|---|---|
| Scientist (m/f/d) to further develop the ISRaD Radiocarbon database — mpg.de/27089434 | The URL now returns the Max Planck job board home page: the posting was removed at source. |

### Data accuracy gap (not a removal)

The stored deadline is empty for every HZDR and Max Planck row, but most official pages state one, for example:
HZDR HPC group leader **30 Nov 2026**, HZDR HPC-RSE-Nexus **29 Nov 2026**, capuchin PhD **1 Dec 2026**, IMPRS-IDI
**18 Dec 2026**. Once those dates pass, the listings stay visible until the next ingestion run notices the posting is
gone. The proposal fills in the confirmed deadlines so the existing deadline gate hides them on time. The real fix is in
the mpg.de/HZDR ingestion adapters (capture the deadline field); it has not been built.

### Needs review (kept active; not confirmed)

- 9 IIT Hyderabad adverts from 2025 still marked "Rolling" by IITH (JRF MAE 14-02-2025, JRF EE 22-07-2025, JRF MAE
  08-09-2025, JRF Physics 04-09-2025, RA-I Physics 04-09-2025, RA-I EE 20-05-2025, and the three lasers & photonics
  Google Drive adverts of 25-09-2025). IITH lists them as current, so they meet the "official source says open" bar,
  but an email to the PIs would confirm they are still being filled.
- IISc RA-I (WRLDC) — not on the official careers listing; content unreadable.
- MPI-CBG ELBE Postdoctoral Fellows and PhD Program — 2024 standing pages, no open call or deadline.
- 7 mpg.de pages could not be fetched (27057371, 27057243, 27057408, 27088031, 27057442, 27061716, 27103974).
- IIT Roorkee Earth Sciences JRF pair (possible duplicate, above).

## New opportunities found (not added)

Verified on the official page on 2026-11-27. Not inserted: adding rows to the production catalogue needs approval,
and these sources are not yet configured in the ingestion pipeline.

| Opportunity | Official page | Deadline (as stated) | Eligibility (summary) | Duration / stipend |
|---|---|---|---|---|
| Science Academies Summer Research Fellowship (SRFP) 2027 — IASc, INSA, NASI | https://webjapps.ias.ac.in/fellowship2027/ | 30 November 2026 | Students/teachers at Indian institutions; teacher recommendation | 2 months in 2027; monthly fellowship + train fare (amount not disclosed) |
| FAST-SF 2027 — IASc, INSA, NASI | https://webjapps.ias.ac.in/fastsf2027/application_instructions.jsp | 30 November 2026 | Students in listed states/UTs only; ≥65% in core subjects; no PhD students | Duration not disclosed; amount not disclosed |
| ICTS S. N. Bhatt Memorial Excellence Fellowship 2027 — ICTS-TIFR | https://www.icts.res.in/academic/summer-research-program | 15 December 2026, 5:00 PM IST (referees by 31 Dec) | UG science/maths/engineering finishing 3rd/4th year by May 2027 (see page) | ~mid-May to mid-July, Bengaluru; stipend + accommodation (amount not disclosed) |
| Summer@EPFL 2027 | https://summer.epfl.ch/ | 29 November 2026 (AoE) | 2nd-year Bachelor's or later in CS/CE/Telecom/EE; no PhD | 2–3 months, Lausanne; CHF 1,800/month + travel |

### Could not verify as currently open

- JNCASR SRFP-2027: "Online applications will open soon"; no dates. Re-check later.
- Caltech SURF: page says "due February 22" with no year; mostly for Caltech-mentored projects.
- DAAD WISE 2027, NCRA-TIFR VSRP 2027, IISER Pune summer 2027, TIFR VSRPs: no official 2027 call found.
- Not suitable: Mitacs Globalink 2027 (call concluded), DAAD RISE Worldwide (students from Germany), EPFL Summer in the Lab (EPFL students only).
- Fetch blocked (retry in a browser): NCBS, ETH SSRF, Weizmann, OIST, RRI.
