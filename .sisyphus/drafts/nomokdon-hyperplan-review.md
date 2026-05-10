# Draft: NomokDon Hyperplan Review

## Requirements (confirmed)
- Aggressively review `docs/pitch/nomokdon_pitch_final.md` against the Toss Special Award criteria.
- Include both Claude and GPT model perspectives and make them argue adversarially.
- Review criteria: problem definition, XRPL usage/technical completeness, feasibility/legal fit, scalability/impact, Toss synergy/PoC potential.

## Technical Decisions
- Use team-mode adversarial review with category members: `unspecified-high`, `ultrabrain`, `artistry`, `unspecified-low`, and `deep`.
- Actual roster includes GPT-backed reviewers and one Claude-backed reviewer per team runtime metadata.

## Research Findings
- Target file located at `docs/pitch/nomokdon_pitch_final.md`.
- Pitch positions NomokDon as an XRPL Credential + Escrow “housing trust pass” for foreign residents facing Korean housing deposits.
- Current pitch has strong emotional hook (“목돈 없이 집 구하기”) and direct XRPL Escrow argument, but vulnerable claims include “DB로 절대 대체 불가”, “Phase 0 금융상품 아님”, “Credential 만료 → Escrow 정산 트리거”, and aggressive market/competitive assertions.
- Toss synergy exists in section 9, but currently reads more like feature placement than a concrete App-in-Toss PoC with Toss-owned distribution, risk controls, and measurable pilot path.
- Toss UX attack finding: current flow is too multi-step/stakeholder-heavy for Toss simplicity; missing exact App-in-Toss user screens, report sharing route, landlord flow, and which Toss APIs/capabilities are needed.
- Toss UX attack finding: demo/pitch may be inconsistent if demo emphasizes Vault/월 12만원 while pitch moved Vault to Phase 2; this weakens feasibility and Toss-native credibility.
- Team consensus score range: problem definition 6-8/10, XRPL use 4-7/10, feasibility 2-6/10, scalability 5-7/10, Toss synergy 6-8/10.
- Consensus fatal risks: headline overpromises zero deposit while Phase 0 only protects/reduces reservation money; legal/financial claims are too absolute; XRPL narrative overstates DB impossibility; App-in-Toss flow lacks concrete screens/API boundary; Vault inflates ambition and regulatory risk.

## Cross-Critique Pending
- Completed. Cross-critique changed the recommendation: do not shrink Phase 0 into a boring compliance/report tool, but also do not present escrow as legally safe money movement. The correct center is “Toss-native landlord-readable trust pass + XRPL-verifiable reservation state/proof + partner-routed KRW/legal boundary.”

## Final Synthesis
- Overall verdict: award-relevant concept, not award-safe wording. Strong hook and Toss fit, but current pitch is vulnerable on feasibility/legal precision and XRPL necessity.
- Score estimate: Problem 7.5/10, XRPL/tech 5.5/10, Feasibility 3.5/10, Scale/impact 6/10, Toss synergy 7/10.
- Claude/Legal side wins on wording guardrails: remove absolute claims, distinguish proof from settlement, keep KRW/legal flow with Toss or regulated partners.
- GPT/Score side wins on ambition: do not over-narrow into a generic report; keep the product as a housing trust pass and keep Vault only as future sandbox upside.
- Toss UX side: convert section 9 from sitemap into 3 actual Toss screens and a landlord share artifact.
- Demo side: freeze live-chain risk with precomputed transactions, screenshots, and a short deterministic flow.

## Top Fixes
1. Rewrite headline to avoid “zero deposit now” bait-and-switch.
2. Reframe Phase 0 as “deposit burden reduction + reservation escrow proof,” not “no deposit.”
3. Replace “DB로 절대 대체 불가” with “XRPL enables third-party verifiable escrow state.”
4. Add hard compliance boundary: Toss/regulated partners handle KRW, XRPL stores proof/state only.
5. Remove/soften “Phase 0 금융상품 아님” absolute claim; say “designed to avoid fund pooling/investment returns.”
6. Replace AI black-box risk score with explainable trust checklist/badge.
7. Add named landlord adoption wedge: partner realtors/low-deposit inventory/guarantee routing.
8. Turn Toss synergy into 3 screens: issue pass, share report, view escrow/rent proof.
9. Move Vault to one future sandbox slide; do not let it dominate Phase 0.
10. Make demo deterministic with precomputed XRPL TX links and fallback screenshots.

## Open Questions
- None blocking; waiting for adversarial team feedback and cross-critique.

## Scope Boundaries
- INCLUDE: critique, score-risk mapping, rewrite priorities, judge-facing improvements.
- EXCLUDE: editing the pitch file or implementing demo changes in this session.
