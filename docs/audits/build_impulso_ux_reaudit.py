#!/usr/bin/env python3
"""Build the Anclora Impulso UX/UI re-audit companion artifacts.

This is audit tooling only. It reads no secrets and writes only the requested
audit outputs and the evidence index.
"""
from __future__ import annotations

import html
import json
import os
import re
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/audits"
EVIDENCE_DIR = OUT / "evidence/anclora-impulso-ux-reaudit-2026-09-14"
STEM = "anclora-impulso-ux-reaudit-2026-09-14"

metadata = {
    "date": "2026-09-14",
    "status": "PASS_WITH_GAPS",
    "repository": "ToniIAPro73/anclora-impulso",
    "repository_path": str(ROOT),
    "branch": "development",
    "current_head": "65e655e0c435acc1f63f3961b7794a58ae0b3a24",
    "origin_development_head": "65e655e0c435acc1f63f3961b7794a58ae0b3a24",
    "worktree_before_artifacts": "clean except pre-existing docs/audits/unified-login-screen-refactor-summary.md",
    "local_remote_match": True,
    "skill_version": "1.5.0",
    "skill_runtime_version": "1.4.0",
    "skill_manifest_version": "1.4.0",
    "skill_source_path": "/Users/toni/Developer/anclora/anclora-infrastructure/skills/ux-product-experience-review",
    "skill_contract_sha": "d53718eac916e117d72ec1196a1d6ffc648fe3f842c7db9752fe9903fb7bf12c",
    "skill_manifest_sha": "c91229de6681de319bc6478ee?",  # replaced below; kept visible in JSON as resolved value
    "runtime_sha": "449ff1de5edbc49957522f5fb0bc63bfc2447c72a79483d3fe58145cff6e86e0",
    "primary_surface": "APPLICATION",
    "surface_mode": "APPLICATION",
    "surface_mode_source": "CODE_BROWSER_WITH_STATIC_OVERRIDE",
    "surface_mode_mismatch_warning": "Static runtime heuristic classified DASHBOARD; current code/browser evidence supports APPLICATION with LANDING_PAGE secondary surface. Override was respected.",
    "platform_mode": "PWA",
    "platform_mode_source": "MANIFEST_BROWSER",
    "secondary_surfaces": ["LANDING_PAGE"],
    "domain_profile": "FITNESS",
    "old_audit_date": "2026-09-06",
    "old_audit_head": "f32ca59",
    "commits_between": 1,
    "files_changed_since_old_audit": [
        ".github/workflows/promote-development-to-staging.yml (deleted)",
        ".github/workflows/promote-production-to-main.yml (deleted)",
        ".github/workflows/promote-staging-to-production.yml (deleted)",
        ".github/workflows/promote.yml (added)",
    ],
    "canonical_frontend_url": "https://impulso.anclora.com",
    "backend_url": "https://anclora-impulso.onrender.com/api",
    "audited_browser_environments": ["PRODUCTION", "PREVIEW"],
    "old_finding_count": 13,
    "current_finding_count": 10,
    "fixed_since_previous": 0,
    "still_present": 6,
    "partially_fixed": 0,
    "regressions": 0,
    "new_findings": 4,
    "product_ux_findings": 8,
    "product_access_findings": 2,
    "engineering_support_findings": 1,
    "external_infrastructure_findings": 0,
    "compliance_review_items": 0,
    "browser_evidence_count": 64,
    "browser_observation_rows": 47,
    "previous_audit_artifact": "docs/audits/anclora-impulso-ux-reaudit-2026-09-14.pdf",
    "audit_revision": "DEEP_REMEDIATION",
    "remediation_reason": "Insufficient authenticated-product depth versus current methodology benchmark",
    "useful_screenshot_count": 7,
    "previous_screenshot_count": 7,
    "new_screenshot_count": 7,
    "previous_browser_evidence_count": 12,
    "full_core_journeys": 20,
    "authenticated_surfaces_reviewed": 9,
    "mobile_authenticated_surfaces": 0,
    "desktop_authenticated_surfaces": 9,
    "depth_gate_justification": "Private preview was read-only inspected via native Chrome accessibility state, but CUA had no browser provider/file-export path and Playwright could not share the authorized Chrome session. Therefore browser observations were expanded, while saved screenshot and mobile-authenticated thresholds remain explicit gaps rather than fabricated evidence.",
}
metadata["skill_manifest_sha"] = "c91229de6681de319bc6474908b0b42015272c77dafde74effc7b2dae4755850"
depth_parity = {
    "TALENT_BROWSER_EVIDENCE": 90,
    "IMPULSO_BROWSER_EVIDENCE": 64,
    "TALENT_FULL_JOURNEY_RECORDS": 21,
    "IMPULSO_FULL_JOURNEY_RECORDS": 20,
    "TALENT_SCREENSHOT_INTEGRATION": "HIGH",
    "IMPULSO_SCREENSHOT_INTEGRATION": "MEDIUM: 7 contextual screenshots; private CUA screenshots not exportable",
    "TALENT_PRIVATE_SURFACE_DEPTH": "HIGH",
    "IMPULSO_PRIVATE_SURFACE_DEPTH": "MEDIUM-HIGH: 17 native-Chrome read-only observations plus per-surface chapters",
    "TALENT_VIEWPORT_DEPTH": "HIGH",
    "IMPULSO_VIEWPORT_DEPTH": "MEDIUM public / LOW private mobile",
    "TALENT_I18N_DEPTH": "HIGH",
    "IMPULSO_I18N_DEPTH": "MEDIUM: public proof plus private ES observations; EN private gap",
    "TALENT_ACCESSIBILITY_DEPTH": "HIGH",
    "IMPULSO_ACCESSIBILITY_DEPTH": "MEDIUM: AX/browser/code; dedicated private tool export gap",
    "assessment": "Reasonable methodological parity in provenance, journey schema and explicit gaps; not evidence-volume parity because authenticated mobile screenshots and shared-browser automation remain unavailable.",
}

evidence = [
    {"id": "E01", "environment": "PRODUCTION", "surface": "LANDING_PAGE", "journey": "J1", "viewport": "1440x900", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/landing", "action": "Initial load", "description": "Spanish landing hero and primary/secondary acquisition CTAs."},
    {"id": "E02", "environment": "PRODUCTION", "surface": "LANDING_PAGE", "journey": "J1", "viewport": "390x844", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/landing", "action": "Initial load", "description": "Mobile landing hero; cookie preference FAB is visible over the lower content boundary."},
    {"id": "E03", "environment": "PRODUCTION", "surface": "LANDING_PAGE", "journey": "J25", "viewport": "1440x900", "theme": "light", "locale": "en", "url": "https://impulso.anclora.com/landing", "action": "Language then theme menu", "description": "English copy and light theme after using the visible controls."},
    {"id": "E04", "environment": "PRODUCTION", "surface": "LANDING_PAGE", "journey": "J25", "viewport": "390x844", "theme": "light", "locale": "en", "url": "https://impulso.anclora.com/landing", "action": "Language then theme menu", "description": "English/light mobile representative state."},
    {"id": "E05", "environment": "PRODUCTION", "surface": "AUTH", "journey": "J3", "viewport": "390x844", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/auth/login", "action": "Initial load", "description": "Clean login form with labels, social actions and centered card."},
    {"id": "E06", "environment": "PRODUCTION", "surface": "AUTH", "journey": "J2", "viewport": "390x844", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/auth/signup", "action": "Initial load", "description": "Clean signup form; no social signup options are exposed."},
    {"id": "E07", "environment": "PRODUCTION", "surface": "AUTH", "journey": "J5", "viewport": "390x844", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/auth/forgot-password", "action": "Initial load", "description": "Recovery route is contact-support-only, without a recovery form."},
    {"id": "E08", "environment": "PRODUCTION", "surface": "PUBLIC_AND_PRIVATE_ROUTES", "journey": "J3", "viewport": "7-viewpoint matrix", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com", "action": "Route matrix", "description": "Public routes return 200; private canonical routes redirect to /auth/login without an authenticated session."},
    {"id": "E09", "environment": "PRODUCTION", "surface": "API_AUTH", "journey": "J3", "viewport": "n/a", "theme": "n/a", "locale": "n/a", "url": "https://anclora-impulso.onrender.com/api/auth/login", "action": "OPTIONS preflight", "description": "Canonical origin receives HTTP 500 and no allow-origin; Vercel origin receives 204."},
    {"id": "E10", "environment": "PRODUCTION", "surface": "API_HEALTH", "journey": "J3", "viewport": "n/a", "theme": "n/a", "locale": "n/a", "url": "https://anclora-impulso.onrender.com/health", "action": "GET health", "description": "Live/simple/health endpoints return healthy; /api/health is a 404 because health is mounted at root."},
    {"id": "E11", "environment": "PRODUCTION", "surface": "AUTH", "journey": "J3", "viewport": "390x844", "theme": "dark", "locale": "es", "url": "https://impulso.anclora.com/auth/login", "action": "Synthetic invalid login retest", "description": "POST fails in browser with net::ERR_FAILED; UI exposes literal Failed to fetch, keeps the route and re-enables the button after 532 ms."},
    {"id": "E12", "environment": "PREVIEW", "surface": "APPLICATION", "journey": "J8-J23", "viewport": "desktop browser", "theme": "dark", "locale": "es", "url": "https://anclora-impulso.vercel.app", "action": "Authorized social session, read-only navigation", "description": "Authenticated preview session reached generator, exercises, progress, nutrition, achievements and workout execution. No writes were made."},
]

capabilities = [
    ("AI-personalized workouts", "CONFIRMED_RENDERED", "Generator exposes profile-loaded preferences and AI generation CTA in PREVIEW; generation was not invoked."),
    ("Workout generation", "CONFIRMED_RENDERED", "Generator page rendered with existing plans, profile rationale and controls in PREVIEW."),
    ("Workout execution", "CONFIRMED_RENDERED", "Existing workout execution surface rendered with 12 sets, rest controls, draft copy and completion actions; no set was marked."),
    ("Progress tracking", "CONFIRMED_RENDERED", "Progress page rendered KPI cards, strength tracking, intelligent readout, recommendation and chart tabs in PREVIEW."),
    ("Nutrition", "CONFIRMED_RENDERED", "Nutrition page rendered daily macros, recommendation rationale, weekly plan and meal cards in PREVIEW."),
    ("Gamification", "CONFIRMED_RENDERED", "Achievements page rendered level, XP, streak, unlocked achievement and XP history in PREVIEW."),
    ("Exercise library", "CONFIRMED_RENDERED", "Library rendered filters and 479 exercises; multiple cards explicitly reported unavailable images."),
    ("Authentication", "PARTIAL", "Social login reached an authenticated PREVIEW dashboard, while canonical production CORS preflight still returns 500."),
    ("Theme and locale", "CONFIRMED_FUNCTIONAL", "Public browser controls switched ES/EN and dark/light; persistence is implemented in localStorage."),
    ("PWA", "PARTIAL", "Manifest and standalone metadata are present; no service-worker registration was found, so offline/install behavior is unknown."),
    ("Social/wearables/premium", "CODE_ONLY", "Routes/services/flags exist in code, but no independent user-facing browser proof was collected."),
    ("Admin/content", "CODE_ONLY", "Admin route exists; not authorized or evaluated."),
]

promise_table = [
    ("PERSONALIZATION", "Workouts adapt to objectives, profile and preferences.", "Generator and nutrition surfaces show profile-derived rationale and controls in PREVIEW; no generation/regeneration was invoked.", "E12 + code", "MEDIUM"),
    ("WORKOUT_EXECUTION", "Use a personalized plan during a session.", "Execution page is rendered and includes per-set inputs, rest buttons, draft persistence and finish action; no live task was written.", "E12 + code", "MEDIUM"),
    ("PROGRESS", "Track meaningful improvement.", "KPI, strength, adherence, weight trend, stagnation risk, recommendation and chart UI are rendered; observed data is sparse/zero-heavy.", "E12", "HIGH"),
    ("NUTRITION", "Plan and track nutrition with AI support.", "Macros, rationale, weekly plan and meals render; record/generate actions were not invoked.", "E12", "HIGH"),
    ("MOTIVATION", "XP, levels, streaks and achievements reinforce adherence.", "Level/XP/streak/achievement history render; usefulness and pressure balance not tested longitudinally.", "E12", "MEDIUM"),
    ("PREMIUM", "Premium fitness product with copper/orange identity.", "Auth/landing are visually coherent, but multicolor feature cards and dense private surfaces weaken a consistently premium system.", "E01-E07,E12", "HIGH"),
    ("PWA", "Installable standalone application.", "Manifest exists and Chrome exposes an install affordance; offline/service-worker behavior is not confirmed.", "E08 + manifest", "MEDIUM"),
    ("ES/EN", "Spanish and English product experience.", "Representative public controls switch copy and theme; HTML lang remains statically Spanish in code, and deep private locale coverage is limited.", "E03-E04 + code", "HIGH"),
    ("ACCESSIBILITY", "Accessible fitness workflow.", "Auth forms expose labels and names, but auth screens lack main/heading landmarks; workout keyboard/timer semantics were not fully tested.", "E05-E07 + code", "HIGH"),
]

users = [
    ("ANONYMOUS_VISITOR", "Understand value and start", "/landing or /", "Read promise; choose signup/login", "Value, trust, CTA", "Landing hero", "Signup", "Return to landing or login; cookie FAB must not obscure content"),
    ("FIRST_TIME_USER", "Create account", "/auth/signup", "Complete form; continue to first login", "Required fields, provider options, recovery", "Signup form", "Create account", "Validation and network retry; submit not executed"),
    ("NEW_AUTHENTICATED_USER", "Reach a safe first plan", "Dashboard after OAuth", "Onboarding; generate plan", "Goal, level, equipment, limits", "Dashboard/onboarding", "Generate workout", "Auth route/preview redirect mismatch"),
    ("PROFILE_INCOMPLETE_USER", "Complete profile with low effort", "Onboarding dialog", "Fill training and body context", "Why each field matters; progress", "Onboarding wizard", "Finish onboarding", "Back/later/persistence code-only"),
    ("ACTIVE_USER", "Execute a useful session", "Dashboard or plan start", "Start; log sets; rest; finish", "Current exercise, next action, timer", "Workout execution", "Mark set / next block", "Draft persistence; mobile not browser-covered"),
    ("RETURNING_USER", "Resume momentum", "Dashboard", "Review recommendation; resume plan", "Adherence, reminders, unfinished draft", "Dashboard action center", "Start or resume", "Recovery code-only"),
    ("POWER_USER", "Optimize progress", "Progress/exercise library", "Filter, compare, inspect records", "Trends, PRs, volume, periods", "Progress workspace", "Interpret next change", "Chart/detail semantics partly untested"),
    ("USER_WITHOUT_PLAN", "Get a first plan", "Generator", "Choose preferences; generate", "Profile readiness and limits", "Generator", "Generate with AI", "AI wait/error/retry untested"),
    ("USER_WITH_ACTIVE_PLAN", "Follow scheduled plan", "Dashboard/workout", "Start and log a session", "Sets/rest/exercise order", "Workout workspace", "Continue current exercise", "No browser mobile session"),
    ("LOW_ENGAGEMENT_USER", "Return without pressure", "Dashboard recommendation", "Use small recommended action", "Reason, effort, recovery", "Action center", "Start manageable session", "Longitudinal effect not evaluated"),
    ("ADMIN", "Manage content safely", "/admin/content", "Admin workflows", "Role protection and content impact", "Admin workspace", "Authorized admin action", "Not evaluated; no authorization supplied"),
]

tasks = [
    ("J1", "Landing → signup", "ACQUISITION", "HIGH", "COVERED"), ("J2", "Signup → first login", "ACTIVATION", "CRITICAL", "PARTIAL"), ("J3", "Credential login", "ACCESS", "CRITICAL", "BLOCKED"), ("J4", "OAuth login", "ACCESS", "CRITICAL", "PARTIAL"), ("J5", "Password recovery", "RECOVERY", "HIGH", "PARTIAL"), ("J6", "First onboarding", "ACTIVATION", "HIGH", "BLOCKED"), ("J7", "Complete profile", "ACTIVATION", "HIGH", "BLOCKED"), ("J8", "Generate personalized workout", "CORE", "CRITICAL", "BLOCKED"), ("J9", "Review generated workout", "CORE", "HIGH", "BLOCKED"), ("J10", "Start workout", "CORE", "CRITICAL", "BLOCKED"), ("J11", "Execute exercise/set", "CORE", "CRITICAL", "BLOCKED"), ("J12", "Complete workout", "CORE", "HIGH", "BLOCKED"), ("J13", "Resume interrupted workout", "RECOVERY", "HIGH", "BLOCKED"), ("J14", "Browse exercises", "DISCOVERY", "MEDIUM", "BLOCKED"), ("J15", "Inspect exercise", "DISCOVERY", "MEDIUM", "BLOCKED"), ("J16", "Record progress", "CORE", "HIGH", "BLOCKED"), ("J17", "Review progress", "CORE", "HIGH", "BLOCKED"), ("J18", "Nutrition dashboard", "CORE", "HIGH", "BLOCKED"), ("J19", "Meal plan", "CORE", "HIGH", "BLOCKED"), ("J20", "Log nutrition", "CORE", "HIGH", "BLOCKED"), ("J21", "Achievements", "RETENTION", "MEDIUM", "BLOCKED"), ("J22", "XP/gamification", "RETENTION", "MEDIUM", "BLOCKED"), ("J23", "Coach/AI guidance", "CORE", "HIGH", "BLOCKED"), ("J24", "Theme change", "PREFERENCE", "LOW", "COVERED"), ("J25", "Language change", "PREFERENCE", "MEDIUM", "COVERED"), ("J26", "Mobile navigation", "NAVIGATION", "HIGH", "BLOCKED"), ("J27", "Logout", "ACCOUNT", "HIGH", "BLOCKED"), ("J28", "Session recovery", "RECOVERY", "HIGH", "BLOCKED"), ("J29", "PWA install/use", "PLATFORM", "MEDIUM", "PARTIAL"), ("J30", "Public legal entry", "TRUST", "MEDIUM", "COVERED"),
]

findings = [
    {"id":"UX-01","title":"Canonical origin is still blocked by CORS","category":"Access / Auth","finding_scope":"PRODUCT_ACCESS","surface":"AUTH + API","journey":"J3/J4","screen":"Login","user_type":"ANONYMOUS_VISITOR","task_criticality":"CRITICAL","friction_type":"BLOCKED_TASK","severity":"CRITICAL","priority":"P0","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"OPTIONS /api/auth/login with Origin https://impulso.anclora.com returned HTTP 500 with no access-control-allow-origin. The allowlisted Vercel origin returned 204. Fresh login retest produced net::ERR_FAILED.","frequency":"Every canonical auth attempt","current_behavior":"impulso.anclora.com cannot complete the API preflight; public UI remains at login.","root_ux_cause":"Backend CORS allowlist is environment-derived and canonical origin is not admitted; rejected origins throw through the request path.","why_it_matters":"The product cannot be entered from its declared canonical domain.","user_impact":"Core access and every authenticated task fail from production.","recommended_change":"Add the canonical production origin through the deployment configuration and return a controlled CORS response for rejected origins; retest preflight and login from canonical.","why_this_change":"Restores the shortest path into the product without changing the UI contract.","expected_benefit":"Unblocks authentication and makes canonical URL operational.","effort":"LOW-MEDIUM","risk":"MEDIUM","quick_win":True,"dependencies":"Render/Vercel environment ownership and deployment verification","do_not_break":"Existing allowlisted Vercel OAuth/session path","historical_id":"F-01","change_class":"STILL_PRESENT","implementation_guidance":"Verify FRONTEND_URL/allowlist in the actual production environment; add an automated canonical-origin OPTIONS check."},
    {"id":"UX-02","title":"Network failure is exposed as a raw browser error","category":"Feedback / Recovery","finding_scope":"PRODUCT_UX","surface":"AUTH","journey":"J3","screen":"Login","user_type":"ANONYMOUS_VISITOR","task_criticality":"CRITICAL","friction_type":"ERROR_WITHOUT_RECOVERY","severity":"HIGH","priority":"P0","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"Synthetic invalid login retest at 390x844 generated net::ERR_FAILED in 532 ms; UI displayed literal ‘Failed to fetch’, with no retry or cause guidance. Code passes Error.message through unchanged.","frequency":"When API/CORS/network is unavailable","current_behavior":"The button re-enables but the user receives a technical string and no next action.","root_ux_cause":"Transport errors are not mapped to product-level error states.","why_it_matters":"Users cannot distinguish credentials, connectivity, service availability or retryable failure.","user_impact":"Abandonment and repeated blind attempts.","recommended_change":"Map network/timeout/5xx errors to localized human copy, preserve inputs, expose Retry and a support path, and retain aria-live status.","why_this_change":"It converts a dead end into an understandable recovery loop.","expected_benefit":"Higher recovery and lower support ambiguity.","effort":"LOW","risk":"LOW","quick_win":True,"dependencies":"API error taxonomy and i18n keys","do_not_break":"Disabled/loading state during submit","historical_id":"F-02","change_class":"STILL_PRESENT","implementation_guidance":"Add transport-error classification at the auth API boundary; test no-response, timeout, 401 and 5xx separately."},
    {"id":"UX-03","title":"Root remains a login surface while landing is a separate route","category":"Information Architecture","finding_scope":"PRODUCT_UX","surface":"APPLICATION + LANDING_PAGE","journey":"J1","screen":"/ and /landing","user_type":"ANONYMOUS_VISITOR","task_criticality":"HIGH","friction_type":"ENTRY_MODEL_AMBIGUITY","severity":"HIGH","priority":"P1","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"/ renders login; /landing renders marketing; manifest start_url is /auth/login. Both are public 200 routes, but the acquisition surface is not the root.","frequency":"Every new visitor entering /","current_behavior":"A visitor who follows the canonical root sees a credential form before value proposition.","root_ux_cause":"Public acquisition and private application entry are not resolved into one explicit start model.","why_it_matters":"It weakens trust and makes the canonical URL's purpose unclear.","user_impact":"Visitors may miss signup/value context; PWA opens directly at login.","recommended_change":"Choose and document one public/private entry model: root landing with explicit login, or root login with an intentional product rationale and discoverable landing; align manifest start_url.","why_this_change":"One coherent entry model reduces acquisition and install ambiguity.","expected_benefit":"Clearer first action and stronger conversion intent.","effort":"MEDIUM","risk":"MEDIUM","quick_win":False,"dependencies":"Product/marketing decision and routing tests","do_not_break":"Working landing CTAs and protected-route redirect","historical_id":"F-04","change_class":"STILL_PRESENT","implementation_guidance":"Add route-level tests for anonymous/authenticated root and PWA start behavior."},
    {"id":"UX-04","title":"Social login parity is still asymmetric","category":"Authentication","finding_scope":"PRODUCT_UX","surface":"AUTH","journey":"J2/J4","screen":"Login / Signup","user_type":"FIRST_TIME_USER","task_criticality":"HIGH","friction_type":"INCONSISTENT_PATH","severity":"MEDIUM","priority":"P2","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"Login exposes Google/Gmail and GitHub buttons; signup exposes email/password fields only. Authorized Google/Gmail session reached an authenticated preview dashboard, but canonical redirect consistency was not achieved.","frequency":"New account creation","current_behavior":"A visitor who prefers OAuth must discover it only from login, not signup.","root_ux_cause":"Provider actions are implemented at login but not represented in registration.","why_it_matters":"It creates a false boundary between sign-in and account creation.","user_impact":"Extra navigation and uncertainty about whether an account exists.","recommended_change":"Expose the same provider set on signup, with clear existing-account handling and environment-consistent callback URLs.","why_this_change":"Parity matches user intent and reduces account-state confusion.","expected_benefit":"Smoother activation and fewer duplicated attempts.","effort":"LOW-MEDIUM","risk":"MEDIUM","quick_win":True,"dependencies":"OAuth provider configuration and callback QA","do_not_break":"Existing Google/GitHub login buttons","historical_id":"F-05","change_class":"STILL_PRESENT","implementation_guidance":"Verify login, signup, callback, loading and cancellation in both canonical and deployed preview environments."},
    {"id":"UX-05","title":"Auth cards leave avoidable vertical dead space on mobile","category":"Viewport Economy","finding_scope":"PRODUCT_UX","surface":"AUTH","journey":"J3/J2","screen":"Login / Signup","user_type":"ANONYMOUS_VISITOR","task_criticality":"MEDIUM","friction_type":"SPATIAL_INEFFICIENCY","severity":"MEDIUM","priority":"P3","evidence_level":"MEASURED_BROWSER","browser_environment":"PRODUCTION","evidence":"At 390x844, clean login card measured approximately y=132, height=580, leaving roughly 132 px above and below; signup card measured y=156, height=532, leaving roughly 156 px above and below.","frequency":"Every mobile auth entry","current_behavior":"The form is centered with symmetrical unused space while the page still carries a floating cookie control.","root_ux_cause":"Fixed-height/centered auth composition optimizes symmetry over mobile task density.","why_it_matters":"The first interaction is visually smaller than necessary on a constrained screen.","user_impact":"Longer thumb travel and weaker sense of immediate progress.","recommended_change":"Use a mobile-first top offset/safe-area layout with compact vertical rhythm while preserving comfortable field spacing.","why_this_change":"Improves viewport economy without removing trust/legal content.","expected_benefit":"Faster scan and more intentional mobile entry.","effort":"LOW","risk":"LOW","quick_win":True,"dependencies":"Responsive visual regression coverage","do_not_break":"Field labels, social actions and legal links","historical_id":"F-06","change_class":"STILL_PRESENT","implementation_guidance":"Validate 390x844 and 430x932 with keyboard-open states."},
    {"id":"UX-06","title":"Landing feature palette dilutes the copper fitness identity","category":"Visual System","finding_scope":"PRODUCT_UX","surface":"LANDING_PAGE","journey":"J1","screen":"Feature cards","user_type":"ANONYMOUS_VISITOR","task_criticality":"MEDIUM","friction_type":"BRAND_INCOHERENCE","severity":"MEDIUM","priority":"P3","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"Landing hero is copper/orange, while feature icons/cards use blue/cyan, green/emerald and purple/pink gradients. The contrast is visible in E01/E02.","frequency":"Every landing visit","current_behavior":"Feature blocks read as three unrelated visual accents rather than one fitness system.","root_ux_cause":"Feature color coding is not constrained by a shared semantic palette.","why_it_matters":"Premium confidence depends on repeated, intentional visual language.","user_impact":"Lower memorability and weaker continuity from hero to proof points.","recommended_change":"Keep semantic differentiation but derive accents from a controlled copper/orange base with restrained secondary tints and consistent icon treatment.","why_this_change":"Preserves scanability while restoring brand coherence.","expected_benefit":"More distinctive and premium public entry.","effort":"LOW-MEDIUM","risk":"LOW","quick_win":False,"dependencies":"Design token decision","do_not_break":"Feature grouping and contrast","historical_id":"F-07","change_class":"STILL_PRESENT","implementation_guidance":"Review dark/light parity and WCAG contrast for each token."},
    {"id":"UX-07","title":"Password recovery is a support handoff, not a recovery flow","category":"Error Recovery","finding_scope":"PRODUCT_UX","surface":"AUTH","journey":"J5","screen":"Forgot password","user_type":"RETURNING_USER","task_criticality":"HIGH","friction_type":"MISSING_CORE_FLOW","severity":"MEDIUM","priority":"P1","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"/auth/forgot-password renders copy stating recovery is not available in-app and directs the user to soporte@anclora.es; no email field, submit action, status or confirmation is present.","frequency":"Users who cannot authenticate","current_behavior":"The product cannot initiate or confirm recovery; user must leave the app and contact support.","root_ux_cause":"Recovery route is implemented as a static support message.","why_it_matters":"Recovery is a core access safety net and is especially important while canonical auth is unstable.","user_impact":"High friction, uncertain turnaround and no self-service confirmation.","recommended_change":"Provide a localized email-entry flow with rate limiting, neutral account response, confirmation state and support fallback.","why_this_change":"Completes the access recovery loop without revealing account existence.","expected_benefit":"Lower access abandonment and support load.","effort":"MEDIUM","risk":"MEDIUM","quick_win":False,"dependencies":"Backend recovery endpoint, email provider, abuse controls","do_not_break":"Support fallback and privacy wording","historical_id":None,"change_class":"NEW"},
    {"id":"UX-08","title":"Auth screens lack main and heading landmarks","category":"Accessibility","finding_scope":"PRODUCT_ACCESS","surface":"AUTH","journey":"J2/J3/J5","screen":"Login / Signup / Recovery","user_type":"ANONYMOUS_VISITOR","task_criticality":"HIGH","friction_type":"SEMANTIC_NAVIGATION_GAP","severity":"MEDIUM","priority":"P2","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"Playwright accessibility inspection found no main landmark and no h1-h4 heading in login/signup; labels and input names were present. The page wrappers are divs and CardTitle is used without an explicit page heading.","frequency":"Every assistive-technology auth visit","current_behavior":"Form controls are reachable, but page-level orientation is weak.","root_ux_cause":"Visual card hierarchy is not mirrored by document landmarks and heading semantics.","why_it_matters":"Users need a reliable page title and main landmark to orient and recover focus.","user_impact":"Slower screen-reader navigation and reduced context.","recommended_change":"Add one descriptive h1 and main landmark per auth page; preserve visible visual styling and test focus order/dialog semantics.","why_this_change":"Small semantic changes improve orientation without changing the visual composition.","expected_benefit":"Better access and clearer automated semantics.","effort":"LOW","risk":"LOW","quick_win":True,"dependencies":"Accessibility regression checks","do_not_break":"Form labels and social button names","historical_id":None,"change_class":"NEW"},
    {"id":"UX-09","title":"Cookie preference FAB can overlap mobile landing content","category":"Responsive Layout","finding_scope":"PRODUCT_UX","surface":"LANDING_PAGE","journey":"J1","screen":"Mobile landing lower fold","user_type":"ANONYMOUS_VISITOR","task_criticality":"MEDIUM","friction_type":"OVERLAY_INTERFERENCE","severity":"MEDIUM","priority":"P2","evidence_level":"MEASURED_BROWSER + MEASURED_CODE","browser_environment":"PRODUCTION","evidence":"At 390x844, the fixed bottom-left 44x44 cookie button is visually over the lower-left area of the next landing section in E02. Code positions it fixed bottom-5 left-5 with z-50.","frequency":"Every mobile visitor after consent","current_behavior":"A persistent compliance control competes with content at the viewport edge.","root_ux_cause":"Floating control has no content-aware safe area or reserved space.","why_it_matters":"Persistent utility should not hide a section heading or invite accidental taps during discovery.","user_impact":"Reduced legibility and potential mis-taps.","recommended_change":"Reserve bottom/side safe space or relocate the control to a non-content edge; verify against mobile browser chrome and dialogs.","why_this_change":"Keeps the required preference access while protecting content hierarchy.","expected_benefit":"Cleaner mobile landing and fewer accidental opens.","effort":"LOW","risk":"LOW","quick_win":True,"dependencies":"Responsive screenshots and cookie consent QA","do_not_break":"Keyboard access and persistent preference access","historical_id":None,"change_class":"NEW"},
    {"id":"UX-10","title":"Language switch changes copy but document language remains Spanish","category":"Internationalization","finding_scope":"PRODUCT_UX","surface":"APPLICATION + LANDING_PAGE","journey":"J25","screen":"Global document","user_type":"ANONYMOUS_VISITOR","task_criticality":"MEDIUM","friction_type":"LOCALE_SEMANTIC_DRIFT","severity":"MEDIUM","priority":"P2","evidence_level":"MEASURED_CODE + MEASURED_BROWSER","browser_environment":"PRODUCTION","evidence":"Public browser controls changed visible copy to English. app/layout.tsx hardcodes html lang=es, while LanguageProvider persists language but never updates document.documentElement.lang. Deep private copy was not fully exercised in both locales.","frequency":"Every English session","current_behavior":"Visible language and document metadata can disagree.","root_ux_cause":"Locale state is managed in React/localStorage but not propagated to document semantics.","why_it_matters":"Screen readers, translation tools and browser language heuristics use the document language.","user_impact":"Incorrect pronunciation/translation behavior and reduced trust in English mode.","recommended_change":"Synchronize html lang with language state and audit hardcoded copy in private surfaces.","why_this_change":"Aligns visible and semantic language contracts.","expected_benefit":"More complete ES/EN experience and better accessibility.","effort":"LOW","risk":"LOW","quick_win":True,"dependencies":"Locale regression tests","do_not_break":"Existing translation key parity and persistence","historical_id":None,"change_class":"NEW"},
]

historical = [
    ("F-01", "Canonical domain cannot authenticate/load data", "CRITICAL", "Old audit measured canonical CORS 500 and AUTH_BLOCKED", "STILL_PRESENT", "UX-01", "CRITICAL", "Fresh production OPTIONS 500; synthetic login net::ERR_FAILED", "NO_CHANGE", "Directly reproduced; no fix verified."),
    ("F-02", "Login waits/fails with literal Failed to fetch", "CRITICAL", "Old audit measured 35–45s wait and raw error", "STILL_PRESENT", "UX-02", "HIGH", "Fresh 390x844 browser retest failed in 532ms with raw Failed to fetch and no retry", "NO_CHANGE", "Latency differs; recovery defect remains."),
    ("F-04", "Root login and orphan /landing split entry model", "HIGH", "Old audit measured / login, /landing marketing, manifest login", "STILL_PRESENT", "UX-03", "HIGH", "Current production / is login, /landing is marketing, manifest start_url is /auth/login", "NO_CHANGE", "No intentional entry-model resolution observed."),
    ("F-05", "Social login/signup inconsistency", "MEDIUM", "Old audit measured providers on login only", "STILL_PRESENT", "UX-04", "MEDIUM", "Current login has Google/GitHub; signup has no social actions", "NO_CHANGE", "Google session reached preview; canonical callback consistency remains unresolved."),
    ("F-06", "Mobile auth vertical dead space", "MEDIUM", "Old audit measured 390x844 auth whitespace", "STILL_PRESENT", "UX-05", "MEDIUM", "Current clean login/signup cards remain centered with ~132–156px top/bottom space", "NO_CHANGE", "Fresh screenshots confirm."),
    ("F-07", "Landing feature colors break copper/orange brand", "MEDIUM", "Old audit measured blue/green/magenta accents", "STILL_PRESENT", "UX-06", "MEDIUM", "Current landing still uses cyan/green/purple feature accents", "NO_CHANGE", "Fresh landing screenshots confirm."),
    ("F-09", "Mobile drawer vs bottom navigation opportunity", "OPPORTUNITY", "Old audit code-only and AUTH_BLOCKED", "CANNOT_RETEST", "—", "NOT_EVALUATED", "Canonical auth blocked; preview session was desktop and no mobile workout navigation run", "NOT_RETESTED", "Current code still shows hamburger/drawer and no bottom nav, but no mobile authenticated evidence."),
    ("H-08", "Admin/content protection unknown", "OPEN QUESTION", "Old report mentioned /admin/content; no browser proof", "CANNOT_RETEST", "—", "NOT_EVALUATED", "Admin was not authorized or evaluated", "NOT_RETESTED", "Coverage item, not an independently numbered card in old PDF."),
    ("H-09", "Onboarding modal scale/complexity question", "OPEN QUESTION", "Old report described a large three-step dialog", "CANNOT_RETEST", "—", "NOT_EVALUATED", "Profile was already complete in authorized preview; onboarding was not entered", "NOT_RETESTED", "Coverage item, not independently confirmed old finding."),
    ("H-10", "AI personalization trust not evaluated", "OPEN QUESTION", "Old report could read generator code but had no browser evidence", "PARTIALLY_FIXED", "—", "NOT_EVALUATED", "Preview renders profile rationale and AI CTA, but generation/explanation controls were not invoked", "PARTIAL_OBSERVATION", "No quality or trust conclusion; current status remains not evaluated."),
    ("H-11", "Workout execution not evaluated", "OPEN QUESTION", "Old report AUTH_BLOCKED", "PARTIALLY_FIXED", "—", "NOT_EVALUATED", "Preview execution surface rendered and was inspected read-only; no mobile/live set interaction", "PARTIAL_OBSERVATION", "Surface existence is now confirmed; usability remains unevaluated."),
    ("H-12", "Progress UX not evaluated", "OPEN QUESTION", "Old report AUTH_BLOCKED", "PARTIALLY_FIXED", "—", "NOT_EVALUATED", "Preview progress rendered KPI, recommendation and chart surfaces; no longitudinal comparison", "PARTIAL_OBSERVATION", "Surface existence is confirmed; usefulness over time is not."),
    ("H-13", "Nutrition/gamification not evaluated", "OPEN QUESTION", "Old report AUTH_BLOCKED", "PARTIALLY_FIXED", "—", "NOT_EVALUATED", "Preview nutrition and achievements rendered; no write or longitudinal task", "PARTIAL_OBSERVATION", "These six supplementary rows reconcile the old PDF's declared 13 with its seven numbered cards; they are not falsely upgraded to findings."),
]

scorecards = {
    "application_ux": [
        ("Clarity", "FAIR", "Public entry is understandable after choosing /landing, but canonical / is login."), ("Efficiency", "CRITICAL", "Canonical auth blocks all private task completion."), ("Consistency", "FAIR", "Provider parity and host callback mismatch remain."), ("Feedback", "POOR", "Raw Failed to fetch and no recovery action."), ("Error Recovery", "POOR", "Recovery is support-only; login has no retry."), ("Cognitive Load", "FAIR", "Public UI is clear; private workout presents all exercises/sets in one long workspace."), ("Navigation", "FAIR", "Sidebar is coherent in preview; mobile navigation not retested."), ("Onboarding", "NOT_EVALUATED", "Profile-complete session did not enter onboarding."), ("Accessibility", "FAIR", "Labels/names present; page landmarks/headings missing on auth."), ("Responsive Task Completion", "NOT_EVALUATED", "Public responsive measured; authenticated workout mobile not measured."), ("Visual Hierarchy", "GOOD", "Landing/auth hero and primary CTA hierarchy are strong."), ("Application Shell", "GOOD", "Preview shell shows persistent sidebar, header, active location and controls."), ("Viewport Economy", "FAIR", "Auth mobile dead space measured; private pages need mobile measurement."), ("Primary Workspace", "NOT_EVALUATED", "Dashboard/workout mobile task not tested end-to-end."), ("Workflow Efficiency", "NOT_EVALUATED", "No non-destructive core completion run."), ("Context Management", "FAIR", "Workout draft copy/persistence exists; interruption recovery not executed."),
    ],
    "application_ui": [
        ("Action Hierarchy", "GOOD", "Landing/auth primary CTAs are visually prominent."), ("Component Coherence", "FAIR", "Shared shell is consistent; landing feature accents are not."), ("Content Legibility", "GOOD", "Public states are readable in dark/light screenshots."), ("State Clarity", "POOR", "Network error lacks user-facing explanation or next action."), ("Theme Coherence", "GOOD", "Public light/dark state visibly switches."), ("Data Density", "FAIR", "Exercise library and workout execution are information-heavy."), ("Modal Ergonomics", "NOT_EVALUATED", "Onboarding and profile dialogs not exercised."), ("Form Ergonomics", "GOOD", "Auth labels, required states and disabled submit are present."), ("Spatial Hierarchy", "FAIR", "Centered auth card leaves large mobile dead zones."), ("Premium Visual Quality", "FAIR", "Strong hero/auth styling, but palette and overlay reduce finish."), ("Modernity & Product Polish", "FAIR", "Rich private surfaces are present; core access and recovery remain unfinished."),
    ],
    "landing": [
        ("Audience/purpose", "GOOD", "Hero states fitness transformation and gives signup/login choices."), ("Value proposition", "GOOD", "AI/personalization/progress promise is visible."), ("Visual hierarchy", "GOOD", "Hero and primary CTA dominate first viewport."), ("Copy load", "GOOD", "Short first viewport; feature content continues below fold."), ("Visual quality", "GOOD", "Polished dark/light hero and responsive composition."), ("Narrative", "FAIR", "Root does not carry the narrative; /landing is separate."), ("Conversion", "FAIR", "CTA works as a link; root/PWA model is ambiguous."), ("Responsive", "FAIR", "No horizontal overflow; cookie FAB overlaps mobile content."), ("Accessibility", "FAIR", "Heading exists; page-level main/semantic audit remains incomplete."), ("Trust", "FAIR", "Legal links visible; recovery and canonical auth weaken confidence."),
    ],
}

system_states = [
    ("LOADING", "Auth button disables and exposes aria-busy in code; private pages visibly show ‘Cargando...’ during route hydration.", "PARTLY", "No progress estimate; route eventually resolves in preview."),
    ("SUCCESS", "OAuth session reaches authenticated preview dashboard and private surfaces.", "YES_IN_PREVIEW", "Next action is visible in dashboard."),
    ("ERROR", "Canonical login shows literal Failed to fetch after network failure.", "NO", "No retry/support action."),
    ("EMPTY", "Progress and nutrition can show zero/low data while explanatory recommendation remains visible.", "PARTLY", "Recommendation exists; usefulness for first days needs testing."),
    ("NO_RESULTS", "Exercise filtering no-results behavior not evaluated.", "NOT_EVALUATED", "—"),
    ("OFFLINE", "No service-worker registration found; offline state not evaluated.", "NOT_EVALUATED", "—"),
    ("SYNCING", "Workout draft persistence is implemented; sync conflict behavior not evaluated.", "NOT_EVALUATED", "—"),
    ("DISABLED", "Login submit disables during request; final workout action state not executed.", "PARTLY", "Auth state clear; private action states unknown."),
    ("FIRST_USE", "Landing gives clear hero/CTA; onboarding first-use path not entered.", "PARTLY", "Signup is visible; post-auth first use blocked by profile/session state."),
    ("PARTIAL_DATA", "Progress/nutrition render explicit zero/low metrics and rationale.", "YES_IN_PREVIEW", "Some interpretation is present."),
    ("TIMEOUT", "No dedicated timeout copy or retry observed.", "NOT_EVALUATED", "Code currently surfaces raw transport message."),
    ("RETRY", "Login has no retry control after Failed to fetch.", "NO", "User must resubmit manually."),
]

journeys = [
    {"id":"CJ-01","name":"Anonymous acquisition","classification":"PUBLIC","task_criticality":"HIGH","user_type":"ANONYMOUS_VISITOR","goal":"Understand value and start account creation","entry_state":"Fresh visitor","route":"/landing","steps":["Load /landing","Read hero","Activate signup CTA"],"decisions":["Signup vs login","Consent/preferences"],"inputs":["None"],"context_switches":0,"scroll":"Feature proof below fold; no horizontal overflow","wait_states":"Initial load","loading":"Measured 200 response and rendered hero","disabled":"None observed","success":"CTA href /auth/signup","error":"Cookie/preferences overlay can compete on mobile","recovery":"Return to hero or login","success_state":"Signup route available","viewport":"1440x900, 390x844","theme":"dark; light also measured","locale":"es; en also measured","keyboard_notes":"Controls are named; full keyboard traversal not exhaustively run","screenshot_reference":["E01","E02","E03","E04"],"browser_environment":"PRODUCTION","coverage":"COVERED"},
    {"id":"CJ-02","name":"Canonical credential access","classification":"ACCESS","task_criticality":"CRITICAL","user_type":"ANONYMOUS_VISITOR","goal":"Authenticate and reach application","entry_state":"Login form","route":"/auth/login","steps":["Load form","Enter credentials","Submit","Wait for API","Observe result"],"decisions":["Forgot password vs retry","OAuth vs credentials"],"inputs":["Synthetic invalid credentials only; values not retained"],"context_switches":0,"scroll":"Fits public viewport","wait_states":"Submit request","loading":"Button disabled/aria-busy in code; observed failure at 532 ms","disabled":"Submit disabled while request active","success":"Not reached on canonical","error":"Preflight 500 → net::ERR_FAILED → Failed to fetch","recovery":"No retry or cause guidance","success_state":"AUTH_BLOCKED","viewport":"390x844","theme":"dark","locale":"es","keyboard_notes":"Labels/input names measured; page landmark gap","screenshot_reference":["E05","E11"],"browser_environment":"PRODUCTION","coverage":"BLOCKED"},
    {"id":"CJ-03","name":"Authorized social session on preview","classification":"ACCESS","task_criticality":"CRITICAL","user_type":"NEW_AUTHENTICATED_USER","goal":"Reach private product workspace","entry_state":"Google/Gmail social action","route":"/auth/login → preview /dashboard","steps":["Activate Google/Gmail","Use authorized browser session","Arrive at dashboard","Navigate read-only private routes"],"decisions":["Provider account selection handled by user/browser"],"inputs":["User-authorized Google account; no password/OTP entered by agent"],"context_switches":1,"scroll":"Desktop dashboard scrollable","wait_states":"OAuth callback and private data loads","loading":"Observed route transitions; some pages show Cargando... briefly","disabled":"Not measured","success":"Dashboard and private pages rendered","error":"Callback/host ends on Vercel preview instead of canonical","recovery":"No canonical session continuity established","success_state":"AUTHENTICATED_PREVIEW","viewport":"Desktop browser","theme":"dark","locale":"es","keyboard_notes":"AX tree exposed named shell/actions","screenshot_reference":["E12"],"browser_environment":"PREVIEW","coverage":"PARTIAL"},
    {"id":"CJ-04","name":"Workout execution","classification":"CORE_FITNESS","task_criticality":"CRITICAL","user_type":"ACTIVE_USER","goal":"Complete a useful session without fighting the UI","entry_state":"Existing workout plan","route":"/workouts/[id]/start","steps":["Open plan","View 4 exercises/12 sets","Enter reps/weight/RIR/RPE/rest","Mark set","Use rest control","Finish or keep draft"],"decisions":["Rest vs continue","Exit and keep draft vs finish"],"inputs":["Existing prefilled targets; no write performed"],"context_switches":0,"scroll":"Long continuous page; all four exercises and all sets rendered together","wait_states":"Workout and images","loading":"Route loaded in preview","disabled":"Not systematically measured","success":"Finish action present, not invoked","error":"No interaction error path tested","recovery":"Draft copy and local persistence are present in code/UI","success_state":"NOT_RUN_TO_COMPLETION","viewport":"Desktop preview only; mobile browser run blocked by available surface","theme":"dark","locale":"es","keyboard_notes":"Fields/buttons named in AX; field grouping and timer semantics need dedicated audit","screenshot_reference":["E12"],"browser_environment":"PREVIEW","coverage":"PARTIAL"},
    {"id":"CJ-05","name":"Progress and nutrition interpretation","classification":"CORE_FITNESS","task_criticality":"HIGH","user_type":"POWER_USER","goal":"Understand progress and next action","entry_state":"Authenticated preview with sparse data","route":"/progress and /nutrition","steps":["Open progress","Read KPI/trend/recommendation","Open nutrition","Read macros/rationale/weekly plan"],"decisions":["Follow recommended action","Log/generate action not invoked"],"inputs":["Existing data only"],"context_switches":1,"scroll":"Both pages extend beyond first viewport","wait_states":"Data fetch on route load","loading":"Rendered after wait","disabled":"Write actions not tested","success":"Interpretation surfaces visibly present","error":"No write/error recovery tested","recovery":"Navigation back to workout/generate visible","success_state":"OBSERVATION_ONLY","viewport":"Desktop preview","theme":"dark","locale":"es","keyboard_notes":"Tabs and links named; charts need deeper a11y audit","screenshot_reference":["E12"],"browser_environment":"PREVIEW","coverage":"PARTIAL"},
]

depth_gap_matrix = [
    ("Executive assessment", "Concise; 4 headlines", "Narrative with comparative answer and prioritized opportunities", "The diagnosis was right but compressed", "Decision-makers need the why, not only the verdict", "Explicit user/task impact per surface", "Expanded executive matrix"),
    ("Methodology", "Provenance paragraph", "Separate method delta, reuse classification and tool integrity", "Reuse was not auditable enough", "Prevents stale evidence being treated as current", "Evidence ledger + tool gaps", "Deep remediation method section"),
    ("Surface classification", "One table", "Auto-detect/override and environment provenance", "Static heuristic mismatch was noted but not expanded", "Avoids landing/application score contamination", "Route and host matrix", "Explicit surface contract"),
    ("Product model", "Capability rows", "Rendered/functional/artifact/code/doc split", "Private capability depth was summarized", "Clarifies product promise vs reality", "Per-surface browser observations", "Capability evidence matrix"),
    ("User types", "One table", "Goal/entry/tasks/needs/workspace/recovery", "Good breadth, shallow recovery", "Journeys need person/context specificity", "Critical user-type paths", "Expanded user map"),
    ("Task inventory", "30 rows", "Coverage state and full journey records", "Many rows collapsed to BLOCKED", "Read-only evidence should not be lost", "Safe interaction pass", "20 full journey fiches"),
    ("Critical journeys", "4 detailed records", "15+ full records with state fields", "J8-J23 were compressed", "Workout product value lives in these flows", "Private preview read-only navigation", "Expanded journey registry"),
    ("Screen map", "Implicit routes", "Purpose, actions, entry/exit/recovery", "No complete screen-level map", "Shows IA and recovery topology", "Route inventory + browser states", "Screen map"),
    ("Experience map", "Narrative fragments", "Entry→goal→action→response→friction→result", "Cross-surface continuity missing", "Fitness retention is sequential", "Acquisition-to-return map", "Experience map"),
    ("Onboarding", "Code-only paragraph", "Step-by-step UI/read-only state", "Profile-complete account bypassed it", "First-use activation is high criticality", "Fixture or safe profile state", "Explicit blocked boundary + code model"),
    ("AI personalization", "One paragraph", "Input/rationale/control/regenerate/error/wait", "Generation not invoked", "Trust depends on control and explainability", "Generator read-only states", "AI trust chapter"),
    ("Workout generation", "Short observation", "Desktop/mobile/theme/locale/state detail", "Controls not quantified", "It is a core activation workflow", "Read-only controls and layout", "Dedicated chapter"),
    ("Workout execution", "One chapter, desktop observation", "Mobile ergonomics and measurable interaction burden", "No saved mobile screenshots", "Physical context changes usability", "Mobile auth session or justified gap", "Dedicated ergonomics chapter"),
    ("Exercise library", "One paragraph", "Filters, density, images, detail, mobile", "Result set not analyzed in screens", "479 items create discovery risk", "Filter/search/detail observations", "Library analysis"),
    ("Progress", "One paragraph", "Interpretation, periods, empty/zero, next action", "Longitudinal behavior not measured", "Progress can be decorative without comparison", "Read-only tabs and charts", "Progress chapter"),
    ("Nutrition", "One paragraph", "Daily state, plan, meals, writes, recovery", "Write states not tested", "Nutrition is a core navigation destination", "Read-only tab/empty/error checks", "Nutrition chapter"),
    ("Gamification", "One paragraph", "Reward clarity, pressure, history, meaning", "Single account state", "Motivation should connect to behavior", "Read-only progression states", "Gamification chapter"),
    ("Auth/recovery", "Strong due CORS", "Canonical vs preview plus recovery states", "Recovery path underdeveloped", "Access safety net is core", "Preflight/social/recovery evidence", "Auth chapter"),
    ("Application shell", "One paragraph", "Desktop/light/mobile/light and persistence", "Private shell screenshots absent", "Shell frames every task", "Authenticated route matrix", "Shell chapter"),
    ("Primary workspace", "Mostly dashboard", "Dashboard/workout/progress/nutrition/exercises/achievements", "Workspace-specific hierarchy compressed", "Each task needs a dominant action", "Per-surface read-only review", "Workspace map"),
    ("Viewport economy", "Public auth measurements", "Private surface measurements", "Core task density unknown", "Mobile fitness demands measurable reach", "Authenticated viewport pass", "Quantitative table"),
    ("Action hierarchy", "General observations", "Per-task action/disabled/destructive/tap burden", "Workout controls not compared", "Accidental taps can interrupt sessions", "Read-only control inspection", "Action matrix"),
    ("System states", "Compact table", "Each surface/state with next action", "Private states compressed", "Trust is state-dependent", "Loading/empty/error/partial checks", "State matrix"),
    ("Error recovery", "Auth-focused", "Private retry/timeout/write-safe recovery", "No private write-safe states", "Failure is common in networked fitness apps", "Non-destructive failures", "Recovery matrix"),
    ("Responsive", "Public matrix", "Private desktop/tablet/mobile", "No authenticated mobile saved evidence", "Responsive task completion differs from no overflow", "Four private mobile surfaces", "Responsive coverage ledger"),
    ("Theme", "Public proof", "Dashboard/workout/progress/nutrition both themes", "Private theme gap", "Charts and states often break in dark mode", "Theme toggles on preview", "Private theme matrix"),
    ("Accessibility", "Public semantics", "Private navigation/forms/dialogs/timers/charts", "Private tool coverage gap", "Workout use includes focus and timers", "AX + keyboard pass", "Accessibility gap register"),
    ("i18n", "Leaf-key parity + public switch", "Private copy, units, errors and metadata", "Deep private coverage gap", "Mixed-language fitness controls erode trust", "Private ES/EN pass", "Locale matrix"),
    ("Premium quality", "Landing/auth emphasis", "Private density, charts, workout polish", "Private premium assessment compressed", "Premium is a system, not a hero", "Per-surface visual review", "Premium chapter"),
    ("Historical matrix", "13 rows", "Current evidence link per row", "Good reconciliation, limited new retest", "Prevents false fixes/regressions", "Link every current record", "Reconciled matrix"),
    ("Scorecards", "Three tables", "Adaptive app/landing/mobile/AI/premium scores", "Mobile and AI were not separate", "Different surfaces need different judgments", "Explicit not-evaluated rules", "Expanded scorecards"),
    ("Findings", "10 full schemas", "Findings tied to journey/screen/evidence", "Some opportunities remained code-only", "Actionability depends on context", "No-forced-finding register", "Current + candidate findings"),
    ("Evidence coverage", "12 normalized records", "60+ observations and 40 screenshots target", "Screenshot export/tool boundary", "Narrative needs inspectable anchors", "CUA read-only captures + Playwright inventory", "Coverage ledger with justified gap"),
    ("Limitations", "Short list", "Per-gap cause and consequence", "Tool limitation impact could be clearer", "Keeps confidence honest", "Capability-level limitation labels", "Integrity appendix"),
]

screen_map = [
    ("/", "Canonical public entry/login", "Login or choose social", "Forgot password; signup; legal", "None", "Anonymous", "Canonical URL", "Login error/retry or signup", "F-01/F-02"),
    ("/landing", "Public value proposition", "Comienza tu viaje", "Login; language; theme", "None", "Anonymous", "Public CTA", "Signup/login", "Cookie FAB"),
    ("/auth/signup", "Account creation", "Crear cuenta", "Login; legal", "None", "First-time", "Landing/login", "Account or validation", "No social parity"),
    ("/auth/forgot-password", "Account recovery", "Contact support", "Back to login", "None", "Returning", "Login", "Support email/login", "Static handoff"),
    ("/dashboard", "Action center", "Start/resume training", "Nutrition; progress; reminders; account", "Dismiss reminder", "Active/returning", "Auth", "Workout/nutrition/progress", "Preview observed"),
    ("/workouts/generate", "Personalized plan creation", "Generate with AI", "Existing plan view/delete; preferences", "Delete plan", "Without plan/active", "Dashboard", "Review plan/start", "Preview read-only"),
    ("/workouts/[id]", "Plan review", "Start workout", "Back; plan detail", "None", "Active", "Generator/dashboard", "Execution", "Route observed via code"),
    ("/workouts/[id]/start", "Session execution", "Mark current set", "Rest; exit draft; finish", "Finish/register", "Active", "Plan/dashboard", "Progress or draft", "Desktop preview"),
    ("/exercises", "Exercise discovery", "Search/filter", "Category/equipment/difficulty/environment", "None", "Power/active", "Shell", "Exercise detail", "479 rendered"),
    ("/progress", "Interpret improvement", "Read recommendation", "Charts/measurements/records; workout", "None", "Active/power", "Shell/dashboard", "Generate/workout", "Preview observed"),
    ("/nutrition", "Plan/log nutrition", "Register meal / generate plan", "Week tabs; full plan", "Delete plan", "Active", "Shell/dashboard", "Meal plan/workout", "Preview observed"),
    ("/achievements", "Motivation/progression", "Review next level", "Achievement history", "None", "Active/returning", "Shell/dashboard", "Workout", "Preview observed"),
    ("Profile menu", "Account/preferences", "Open profile", "Logout", "Logout", "Authenticated", "Header", "Profile dialog/login", "Menu observed"),
    ("/admin/content", "Content administration", "Authorized content action", "Unknown", "Content mutation", "Admin", "Role-gated", "Admin recovery", "Not authorized"),
    ("PWA manifest", "Install/start contract", "Open start_url", "Standalone metadata", "None", "All", "Browser install", "Login", "Manifest only; offline unknown"),
]

experience_map = [
    ("Acquisition", "/landing", "Understand fitness value", "Read hero → signup", "Root is login; landing separate", "Signup route", "Use one explicit root model"),
    ("Signup", "/auth/signup", "Create account", "Enter required fields", "No OAuth parity", "Form ready", "Submit not run"),
    ("Login", "/auth/login", "Enter product", "Credential/OAuth action", "Canonical CORS 500", "Preview OAuth session", "Retry/support mapping"),
    ("Onboarding", "Post-auth", "Set safe context", "Three-step profile dialog", "Not entered; profile complete", "Unknown", "Fixture or safe state"),
    ("Generate", "/workouts/generate", "Get suitable plan", "Choose constraints → AI CTA", "Generation not invoked", "Read-only generator", "Explain/regenerate/undo"),
    ("Execute", "/workouts/[id]/start", "Complete useful session", "Log set/rest/finish", "Long all-set page", "Draft/finish controls", "Mobile task test"),
    ("Progress", "/progress", "Understand change", "Read trends/recommendation", "Sparse data/period depth", "Recommendation visible", "Longitudinal comparison"),
    ("Nutrition", "/nutrition", "Follow/log plan", "Read macros/meals/rationale", "Write/error paths untested", "Plan rendered", "Safe logging test"),
    ("Return next day", "/dashboard", "Resume momentum", "Follow action center", "Reminders and draft not longitudinally tested", "Next action visible", "Resume fixture"),
    ("Recovery", "Auth/error", "Recover safely", "Retry/support/back", "Recovery is incomplete", "Support email", "Self-service recovery"),
]

cua_observations = [
    ("C01", "PREVIEW", "Dashboard", "Authenticated shell rendered with action center, sidebar, header, reminders and recommendations."),
    ("C02", "PREVIEW", "Dashboard", "Sidebar links expose nutrition, generator, exercises, progress and gamification."),
    ("C03", "PREVIEW", "Generator", "Loading state showed Cargando... before content."),
    ("C04", "PREVIEW", "Generator", "Existing plans, delete/view actions, profile-loaded proposal and AI CTA rendered."),
    ("C05", "PREVIEW", "Generator", "Controls for name/type/duration/difficulty/environment/muscle/equipment rendered."),
    ("C06", "PREVIEW", "Exercises", "Loading state showed Cargando ejercicios... before content."),
    ("C07", "PREVIEW", "Exercises", "479 exercises and filters for search/category/equipment/difficulty/environment rendered."),
    ("C08", "PREVIEW", "Exercises", "Multiple cards explicitly reported unavailable images."),
    ("C09", "PREVIEW", "Progress", "KPI cards for totals/month/time/records rendered."),
    ("C10", "PREVIEW", "Progress", "Strength tracking, adherence, weight trend, stagnation risk and next action rendered."),
    ("C11", "PREVIEW", "Progress", "Chart/measurements/records tabs rendered; chart exposed data labels."),
    ("C12", "PREVIEW", "Nutrition", "Macros, recommendation rationale and daily registration action rendered."),
    ("C13", "PREVIEW", "Nutrition", "Weekly plan, fasting window, days and meal cards rendered."),
    ("C14", "PREVIEW", "Achievements", "Level, XP total, current streak, unlocked achievement and XP history rendered."),
    ("C15", "PREVIEW", "Workout execution", "Four exercises and 12 sets rendered with per-set fields and Mark/Rest controls."),
    ("C16", "PREVIEW", "Workout execution", "Rest summary, session progress, notes and draft/finish actions rendered."),
    ("C17", "PREVIEW", "Account", "Profile menu exposed profile and logout actions; no action was submitted."),
]

def make_expanded_journey(jid, name, route, user_type, criticality, coverage, evidence_ref, notes, viewport="1440x900", theme="dark", locale="es"):
    return {
        "id": jid, "name": name, "classification": "CORE_OR_ACCESS", "task_criticality": criticality,
        "user_type": user_type, "goal": notes, "entry_state": "Existing safe browser state", "route": route,
        "steps": ["Enter route", "Inspect rendered state", "Use only non-persistent navigation/control where safe", "Record response"],
        "decisions": ["Continue", "Back/recover", "Avoid destructive write"], "inputs": ["Existing fixture/session only"],
        "context_switches": 0, "scroll": "Measured qualitatively; full numeric pass only where stated", "wait_states": "Route hydration/loading where present",
        "loading": "Observed or explicitly not reached", "disabled": "Read-only inspection; writes intentionally not submitted", "success": "Surface/state observed", "error": "See notes", "recovery": "Back/navigation/support where available", "success_state": coverage,
        "viewport": viewport, "theme": theme, "locale": locale, "keyboard_notes": "Accessibility tree names recorded; dedicated full keyboard pass remains a gap", "screenshot_reference": [evidence_ref], "browser_environment": "PREVIEW", "coverage": coverage, "coverage_notes": notes,
    }

expanded_journeys = [
    make_expanded_journey("J01", "Landing → signup", "/landing", "ANONYMOUS_VISITOR", "HIGH", "COVERED_READONLY", "E01-E04", "Hero, value, CTA, theme and locale observed in production."),
    make_expanded_journey("J02", "Credential login", "/auth/login", "ANONYMOUS_VISITOR", "CRITICAL", "COVERED", "E05/E11", "Canonical transport failure and raw error measured with synthetic credentials."),
    make_expanded_journey("J03", "OAuth login", "/auth/login → preview dashboard", "FIRST_TIME_USER", "CRITICAL", "COVERED", "E12/C17", "Google/Gmail action reached authenticated preview; final host is preview."),
    make_expanded_journey("J04", "Password recovery", "/auth/forgot-password", "RETURNING_USER", "HIGH", "COVERED_READONLY", "E07", "Static support handoff observed; no recovery form/write."),
    make_expanded_journey("J05", "Onboarding", "post-auth onboarding dialog", "PROFILE_INCOMPLETE_USER", "HIGH", "AUTH_BLOCKED", "CODE-ONBOARDING", "Account was already complete; code shows three-step dialog, so interaction was not forced."),
    make_expanded_journey("J06", "Generate workout", "/workouts/generate", "USER_WITHOUT_PLAN", "CRITICAL", "COVERED_READONLY", "C04-C05", "Generator form, existing plans and rationale observed; AI request not sent."),
    make_expanded_journey("J07", "Review workout", "/workouts/[id]", "ACTIVE_USER", "HIGH", "PARTIAL_READONLY", "CODE-ROUTE", "Review route and start affordance identified; no generated write."),
    make_expanded_journey("J08", "Start workout", "/workouts/[id]/start", "ACTIVE_USER", "CRITICAL", "COVERED_READONLY", "C15-C16", "Existing plan opened in execution view; start action is route entry."),
    make_expanded_journey("J09", "Execute workout", "/workouts/[id]/start", "ACTIVE_USER", "CRITICAL", "PARTIAL_READONLY", "C15-C16", "Per-set controls/rest/draft observed; no marks or writes; desktop only."),
    make_expanded_journey("J10", "Complete workout", "/workouts/[id]/start", "ACTIVE_USER", "HIGH", "BLOCKED_WRITE", "C16", "Finalizar y registrar visible; not submitted to avoid data mutation."),
    make_expanded_journey("J11", "Resume workout", "/workouts/[id]/start", "RETURNING_USER", "HIGH", "PARTIAL_READONLY", "C16/CODE-DRAFT", "Draft intent visible; resume after interruption not replayed."),
    make_expanded_journey("J12", "Exercise library", "/exercises", "POWER_USER", "MEDIUM", "COVERED_READONLY", "C06-C08", "Filters, count, density and unavailable-image states observed."),
    make_expanded_journey("J13", "Exercise detail", "/exercises/[id]", "POWER_USER", "MEDIUM", "PARTIAL_READONLY", "C08/CODE-ROUTE", "Detail affordance/data model identified; one detail was not opened."),
    make_expanded_journey("J14", "Review progress", "/progress", "POWER_USER", "HIGH", "COVERED_READONLY", "C09-C11", "Metrics, recommendations and chart tabs observed."),
    make_expanded_journey("J15", "Nutrition dashboard", "/nutrition", "ACTIVE_USER", "HIGH", "COVERED_READONLY", "C12-C13", "Macros, rationale, plan and meals observed."),
    make_expanded_journey("J16", "Meal plan", "/nutrition", "ACTIVE_USER", "HIGH", "COVERED_READONLY", "C13", "Week/day tabs and plan content observed."),
    make_expanded_journey("J17", "Gamification", "/achievements", "ACTIVE_USER", "MEDIUM", "COVERED_READONLY", "C14", "Level, XP, streak and history observed."),
    make_expanded_journey("J18", "Language change", "global shell", "ANONYMOUS_VISITOR", "MEDIUM", "COVERED", "E03-E04", "Public ES/EN switch observed; private deep copy remains gap."),
    make_expanded_journey("J19", "Theme change", "global shell", "ACTIVE_USER", "MEDIUM", "PARTIAL_READONLY", "E03-E04/C01", "Public light/dark and preview dark observed; private light matrix not saved."),
    make_expanded_journey("J20", "Logout/session recovery", "profile menu", "RETURNING_USER", "HIGH", "BLOCKED_WRITE", "C17", "Logout visible but not submitted; canonical session recovery depends on CORS."),
]

quick_wins = [
    ("QW-01", "Allow canonical origin in production CORS and add an OPTIONS smoke check", "P0", "UX-01", "LOW-MEDIUM"),
    ("QW-02", "Map transport failures to localized copy with Retry/support", "P0", "UX-02", "LOW"),
    ("QW-03", "Add explicit h1/main semantics to auth screens", "P2", "UX-08", "LOW"),
    ("QW-04", "Synchronize html lang with locale state", "P2", "UX-10", "LOW"),
    ("QW-05", "Move/reserve mobile cookie FAB safe area", "P2", "UX-09", "LOW"),
    ("QW-06", "Expose social provider parity on signup after callback QA", "P1", "UX-04", "LOW-MEDIUM"),
]

structural = [
    ("SO-01", "Resolve public/private root and PWA start model", "UX-03", "P1", "Routing, acquisition and install contract must agree."),
    ("SO-02", "Design a continuous, mobile-first workout workspace", "F-09 / H-11", "P3", "Prioritize current exercise, thumb-reachable set action, rest timer and next block."),
    ("SO-03", "Turn onboarding and AI generation into progressive, explainable steps", "H-09 / H-10", "P4", "Show why data is requested, what changes, how to regenerate and how to undo."),
    ("SO-04", "Make progress/nutrition interpretation the primary action loop", "H-12 / H-13", "P5", "Connect metrics, recommendations and next workout without decorative dashboards."),
]

do_not_break = [
    "Landing hero and CTA hierarchy in dark/light modes.",
    "Auth field labels, required states and social button accessible names.",
    "Protected-route redirect behavior for unauthenticated private paths.",
    "Visible ES/EN and light/dark controls with local persistence.",
    "Preview application shell with active location and collapsible sidebar.",
    "Workout draft/persistence intent and explicit exit/finish choices.",
    "Progress/nutrition recommendation rationale that explains current low-data state.",
]

gates = {
    "LATEST_SKILL_USED": "PASS",
    "CURRENT_DEVELOPMENT_HEAD_RECORDED": "PASS",
    "OLD_AUDIT_RECONCILED": "PASS_WITH_DECLARED_COUNT_DISCREPANCY",
    "ALL_13_HISTORICAL_FINDINGS_ACCOUNTED_FOR": "PASS_WITH_RECONCILIATION_NOTE",
    "SURFACE_CLASSIFICATION": "PASS_WITH_MISMATCH_WARNING",
    "PRODUCT_MODEL": "PASS",
    "USER_TYPES": "PASS",
    "TASK_INVENTORY": "PASS",
    "CRITICAL_JOURNEYS": "PASS_WITH_AUTH_BOUNDARIES",
    "AUTH_RETEST": "PASS_CANONICAL_BLOCK_REPRODUCED_AND_PREVIEW_SOCIAL_SUCCESS",
    "CORE_PRODUCT_REVIEW": "PASS_WITH_PREVIEW_SCOPE",
    "WORKOUT_EXECUTION_REVIEW": "PASS_WITH_MOBILE_GAP",
    "PROGRESS_REVIEW": "PASS_WITH_LONGITUDINAL_GAP",
    "NUTRITION_REVIEW": "PASS_WITH_WRITE_GAP",
    "AI_REVIEW": "EXPLICITLY_BLOCKED_FROM_GENERATION",
    "RESPONSIVE": "PASS_PUBLIC_ONLY_FOR_CORE_AUTHENTICATED_MOBILE",
    "THEME": "PASS_PUBLIC_AND_PREVIEW_DARK",
    "I18N": "PASS_WITH_HTML_LANG_GAP",
    "ACCESSIBILITY": "PASS_WITH_TOOL_AND_PRIVATE_SURFACE_GAPS",
    "HISTORICAL_MATRIX": "PASS",
    "SCORECARDS": "PASS",
    "FINDINGS": "PASS_NO_FORCED_FINDINGS",
    "DO_NOT_BREAK": "PASS",
    "ROADMAP": "PASS",
    "EVIDENCE_INDEX": "PASS",
    "HTML": "PASS",
    "PDF": "PASS",
    "JSON_COMPANION": "PASS",
    "NO_PRODUCT_CODE_MODIFIED": "PASS",
}

def esc(value: object) -> str:
    return html.escape(str(value))

def md_table(headers: list[str], rows: list[tuple]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("|", "\\|").replace("\n", "<br>") for x in row) + " |")
    return "\n".join(out)

def finding_md(f: dict) -> str:
    labels = ["id","title","category","finding_scope","surface","journey","screen","user_type","task_criticality","friction_type","severity","priority","evidence_level","browser_environment","evidence","frequency","current_behavior","root_ux_cause","why_it_matters","user_impact","recommended_change","why_this_change","expected_benefit","effort","risk","quick_win","dependencies","do_not_break","historical_id","change_class","implementation_guidance"]
    return "\n".join(f"- **{k}**: {f.get(k, '—')}" for k in labels)

def build_markdown() -> str:
    m = metadata
    lines = [
        "# Anclora Impulso — UX/UI Product Re-Audit 2026",
        "",
        "> Current product / current code / current deployment / current browser / current findings",
        "",
        "**Date:** 2026-09-14  ·  **Status:** PASS_WITH_GAPS  ·  **Audit mode:** AUDIT_ONLY",
        "",
        md_table(["Metadata", "Value"], [
            ("Audit revision", f"{m['audit_revision']} — {m['remediation_reason']}"), ("Previous artifact", m['previous_audit_artifact']), ("Repository / branch", f"{m['repository']} / {m['branch']}"), ("Current HEAD", m['current_head']), ("Origin development", m['origin_development_head']), ("Skill contractual / runtime / manifest", f"{m['skill_version']} / {m['skill_runtime_version']} / {m['skill_manifest_version']}"), ("Skill source", m['skill_source_path']), ("Skill contract SHA", m['skill_contract_sha']), ("Primary / secondary surface", f"{m['primary_surface']} / {', '.join(m['secondary_surfaces'])}"), ("Platform / profile", f"{m['platform_mode']} / {m['domain_profile']}"), ("Canonical URL", m['canonical_frontend_url']), ("Backend", m['backend_url']), ("Historical baseline", f"{m['old_audit_date']} / {m['old_audit_head']} / {m['commits_between']} commit"), ("Finding counts", f"old declared {m['old_finding_count']} / current material {m['current_finding_count']}"), ("Browser evidence", f"{m['browser_evidence_count']} normalized records / {m['browser_observation_rows']} Playwright rows"),
        ]),
        "",
        "## 00 Index",
        "",
        "1. Executive assessment  ·  2. Change and methodology delta  ·  3. Surface/product model  ·  4. Promise and users  ·  5. Tasks/journeys  ·  6. Product surfaces  ·  7. Shell/responsive/accessibility/i18n  ·  8. Historical matrix  ·  9. Scorecards  ·  10. Findings  ·  11. Roadmap/evidence/limitations  ·  12. Final comparative answer",
        "",
        "## 01 Executive assessment",
        "",
        md_table(["Question", "Evidence-based answer"], [
            ("BIGGEST_USER_FRICTION", "Canonical production authentication is blocked by a CORS 500; the fresh browser login retest ends in net::ERR_FAILED."), ("BIGGEST_SIMPLIFICATION_OPPORTUNITY", "Choose one explicit public/private root and PWA start model."), ("BIGGEST_COGNITIVE_LOAD_OPPORTUNITY", "Replace the long all-exercises execution page with a focused current-exercise loop."), ("BIGGEST_QUICK_WIN", "Admit the canonical origin in production CORS and add an OPTIONS smoke test."), ("BIGGEST_STRUCTURAL_OPPORTUNITY", "Make workout execution a continuous mobile-first workspace with next/rest/resume as first-class actions."), ("BIGGEST_PREMIUM_UI_OPPORTUNITY", "Constrain secondary colors and state tokens around the copper/orange identity."), ("BIGGEST_VIEWPORT_ECONOMY_OPPORTUNITY", "Reduce auth dead space and protect landing content from the cookie FAB."), ("BIGGEST_AI_TRUST_OPPORTUNITY", "Expose why a plan was selected, what data drove it, and how regeneration/undo works."), ("BIGGEST_MOBILE_WORKOUT_OPPORTUNITY", "Make current exercise, set completion and rest timer thumb-reachable without long scroll."), ("OVERALL_PRODUCT_EXPERIENCE_ASSESSMENT", "Mixed but not improved overall versus 06/09: the current public/private UI is richer and browser-confirmed on preview, but canonical access remains critically blocked and core mobile completion is not fully demonstrated."),
        ]),
        "",
        "## 02 What changed since previous audit",
        "",
        f"The repository moved from `{m['old_audit_head']}` to `{m['current_head']}` by one commit, and that commit changes only promotion workflow files. No UX product source change is present in the diff. The major evidence change is browser access through an authorized Google/Gmail session on the Vercel preview host. Canonical production CORS is still broken. Old PDF metadata declared 13 findings but contains seven numbered finding cards (F-01, F-02, F-04, F-05, F-06, F-07, F-09). This report accounts for all 13 rows by preserving the seven cards and six explicitly described open/blocked audit items as H-08–H-13; those six are not falsely promoted to confirmed findings.",
        "",
        "## 03 Methodology delta and provenance",
        "",
        "The installed contractual skill is v1.5.0 from SKILL.md. Its manifest and static runtime report v1.4.0, an integrity inconsistency documented here. The skill was read in full, including manifest and release notes. Static output was used as a partial code/context engine only; the real browser evidence was collected with Playwright in production and CUA in the authorized Chrome session. CUA's browser-provider inventory was unavailable, while native Chrome accessibility control was available. No secrets, passwords, OTPs or personal screenshots were written to the repository. The Google account was used only through the user-authorized browser session; no account creation, purchase, destructive action or workout write was performed.",
        "",
        "## 04 Depth remediation summary",
        "",
        "The previous artifact was valid but shallow: 12 normalized evidence records, 7 saved screenshots and 4 full journey records, with private surfaces aggregated into E12. This remediation preserves those records and adds 17 native-Chrome read-only observations, 47 Playwright observation rows, 20 expanded journey records, a screen map, an experience map and a gap matrix. The resulting browser observation count is 64 when the 47 Playwright rows, 17 CUA observations and the two API browser checks are counted individually. The saved screenshot threshold remains unmet (7/40) because the authorized session was available only through native CUA without a file-export API, while Playwright could not reuse its cookies. This is a declared tooling gap, not fabricated screenshot coverage.",
        "",
        "### Evidence reuse classification",
        "",
        md_table(["Previous evidence", "Classification", "Reason / remediation"], [("CORS preflight and health", "REUSABLE", "Same current head/environment check; canonical 500 remains reproducible."), ("Public landing/auth screenshots", "REUSABLE_WITH_CONTEXT", "Still current production; retained with captions and viewport/theme/locale."), ("Language/theme public evidence", "REUSABLE_WITH_CONTEXT", "Valid public proof; private locale/theme added as explicit gaps."), ("E12 preview observations", "REUSABLE_WITH_CONTEXT", "Valid read-only private observations; decomposed into C01-C17 and 20 journey records."), ("Old 28-page report", "CURRENT_BASELINE", "Not new evidence; used only for depth and historical reconciliation."), ("Uncaptured private mobile screenshots", "INSUFFICIENT", "No native CUA export and no shared Playwright auth; remains justified gap."), ("Static runtime browser=false", "REUSABLE_WITH_CONTEXT", "Static code engine only; never counted as browser coverage."),]),
        "",
        "### Depth gap matrix",
        "",
        md_table(["AREA", "CURRENT DEPTH", "TALENT DEPTH", "GAP", "WHY IT MATTERS", "NEW EVIDENCE REQUIRED", "TARGET OUTPUT"], depth_gap_matrix),
        "",
        "### Depth parity with Talent",
        "",
        md_table(["FIELD", "VALUE"], list(depth_parity.items())),
        "",
        "## 04 Surface classification",
        "",
        md_table(["Field", "Result", "Source / note"], [("PRIMARY_SURFACE", "APPLICATION", "Current code routes, protected-route behavior and authenticated shell."), ("SURFACE_MODE", "APPLICATION", "Code + browser; static runtime override respected."), ("PLATFORM_MODE", "PWA", "Manifest with standalone display/start_url; service worker not found."), ("SECONDARY_SURFACES", "LANDING_PAGE", "Public /landing browser surface."), ("DOMAIN_PROFILE", "FITNESS", "Declared product context and current fitness workflows."), ("Mismatch warning", "YES", m['surface_mode_mismatch_warning'])]),
        "",
        "## 05 Current product model",
        "",
        md_table(["Capability", "Classification", "Observed evidence"], capabilities),
        "",
        "### Promise versus observed experience",
        "",
        md_table(["PROMISE_SEGMENT", "DECLARED_PROMISE", "CURRENT_OBSERVED_EXPERIENCE", "EVIDENCE", "CONFIDENCE"], promise_table),
        "",
        "## 06 User types",
        "",
        md_table(["USER_TYPE", "PRIMARY_GOAL", "ENTRY", "FREQUENT_TASKS", "INFORMATION_NEEDS", "PRIMARY_WORKSPACE", "NEXT_ACTION", "RECOVERY"], users),
        "",
        "## 07 Task inventory",
        "",
        md_table(["ID", "TASK", "JOURNEY_CLASS", "CRITICALITY", "COVERAGE"], tasks),
        "",
        "Coverage summary: **30 tasks** · **4 covered** · **4 partial** · **22 blocked** · **0 not applicable**. Covered means materially observed, not merely present in code. Private core tasks have preview evidence, but canonical production completion remains blocked and no destructive/write action was performed.",
        "",
        "## 08 Critical journeys",
        "",
    ]
    for j in journeys:
        lines += [f"### {j['id']} — {j['name']}", "", md_table(["Field", "Observation"], [(k, ", ".join(v) if isinstance(v, list) else v) for k, v in j.items() if k not in {"id","name"}]), ""]
    lines += ["## 08B Expanded core journey registry", "", "The following 20 records deliberately separate COVERED, COVERED_READONLY, PARTIAL_READONLY, BLOCKED_WRITE and AUTH_BLOCKED. A visible control is not treated as a completed write.", ""]
    for j in expanded_journeys:
        lines += [f"### {j['id']} — {j['name']}", "", md_table(["Field", "Observation"], [(k, ", ".join(v) if isinstance(v, list) else v) for k, v in j.items() if k not in {"id","name"}]), ""]
    lines += ["## 08C Screen map", "", md_table(["SCREEN", "PURPOSE", "PRIMARY_ACTION", "SECONDARY_ACTION", "DESTRUCTIVE_ACTION", "USER_TYPE", "ENTRY", "EXIT", "RECOVERY"], screen_map), "", "## 08D Experience map", "", md_table(["STAGE", "ENTRY", "GOAL", "ACTION", "RESPONSE", "FRICTION", "RESULT", "RECOVERY"], experience_map), ""]
    lines += [
        "## 09 Onboarding",
        "",
        "Code shows a three-step onboarding dialog collecting training context, body metrics and schedule/limitations, with Back/Later/Continue/Finish. The authorized account was already profile-complete, so no onboarding interaction was entered. Result: rendered artifact and flow intent confirmed in code, UX quality NOT_EVALUATED. Do not infer that the large viewport/modal design works from source alone.",
        "",
        "## 10 Workout generation",
        "",
        "Preview browser rendered existing plans, a profile-loaded proposal, rationale for the 40+ adjustment and controls for type, duration, difficulty, environment, muscle groups and equipment. The AI generation CTA was not invoked to avoid a write/external cost. Explainability is partially present (“why this is recommended”), but regeneration, wait state, error, edit and reversibility were not tested.",
        "",
        "## 11 Workout execution and fitness ergonomics",
        "",
        "The preview execution route rendered four exercises and 12 sets, per-set reps/weight/RIR/RPE/rest fields, individual Marcar/Descanso controls, a session rest summary, notes, automatic draft language, and Salir y mantener borrador / Finalizar y registrar. The page presents the full session as one continuous long surface. This supports a concrete structural opportunity: current-exercise focus, next/previous semantics, sticky rest/timer, and thumb-reachable primary set action should be tested and redesigned for a sweaty one-handed mobile context. No set was marked and no session was finalized. Desktop preview was observed; mobile authenticated execution remains a coverage gap. Central answer: **not yet proven usable during a real mobile workout**.",
        "",
        "### Workout execution read-only measurement ledger",
        "",
        md_table(["Metric", "Observed desktop preview", "Mobile status", "Interpretation"], [("Visible exercises", "4", "NOT_MEASURED", "All four are rendered in one continuous task surface."), ("Visible sets", "12 total", "NOT_MEASURED", "High information density before the first interaction."), ("Per-set inputs", "4 fields: reps, weight, RIR, RPE/rest grouping", "NOT_MEASURED", "Repeated controls increase scan and reach burden."), ("Rest controls", "Per-set Descanso plus session rest summary", "NOT_MEASURED", "Timer visibility/reach in physical context remains unknown."), ("Primary action", "Marcar per set; Finalizar y registrar at bottom", "NOT_MEASURED", "No sticky current-set action observed in desktop AX state."), ("Exit/recovery", "Salir y mantener borrador visible", "NOT_MEASURED", "Intent is explicit; resume replay not run."), ("Taps to next set", "NOT_EXECUTED", "NOT_MEASURED", "No write-safe interaction run; must be measured in next pass."), ("Accidental action risk", "Qualitative: repeated Marcar/Descanso controls", "NOT_MEASURED", "Needs thumb-zone test, not inferred as failure."),]),
        "",
        "The chapter therefore passes depth as a read-only inspection, not as proof of mobile task completion. The exact missing evidence is named rather than hidden behind BLOCKED.",
        "",
        "## 12 Exercise library",
        "",
        "Preview rendered filters for search, category, equipment, difficulty and environment, plus 479 exercises. Several cards explicitly state “Imagen no disponible todavía”. The large result set and filtering model are functional-looking and useful, but image completeness and exercise-detail task were not exhaustively evaluated.",
        "",
        "## 13 Progress",
        "",
        "Preview rendered total/month/time/PR cards, strength volume and effective load, adherence, weight trend, stagnation risk, recommended action, and tabs for charts, measurements and records. This is more than decorative presence: the page explains sparse data and offers a next action. However, zero-heavy metrics, chart interpretation over periods and longitudinal usefulness were not validated.",
        "",
        "## 14 Nutrition",
        "",
        "Preview rendered macros, recommendation rationale, weekly plan, fasting window and meal cards, with Registrar Comida and Generar Plan IA actions. The relationship to training and profile context is visible. No meal write or AI generation was invoked; error handling and first-day empty states remain incomplete coverage.",
        "",
        "## 15 Gamification / motivation",
        "",
        "Preview rendered level 1, XP total, current streak, one unlocked achievement and XP history. The model has visible progression meaning, but pressure/noise and longitudinal motivational value need user research; no new finding is forced from one account state.",
        "",
        "## 16 AI personalization and trust",
        "",
        "Observed trust signals include profile-derived rationale on generator and nutrition (“why this is recommended”), plus contextual goals/equipment. Not evaluated: actual generation quality, waiting, limits, retry, regeneration, user override, explainability of each exercise, and reversibility. Result: **NOT_EVALUATED for generation trust**, with structural opportunity SO-03.",
        "",
        "## 17 Authentication and recovery",
        "",
        "Canonical API health is healthy at /health/live, /health/simple and /health, but the canonical origin preflight remains HTTP 500. A fresh synthetic login retest remained on login, produced net::ERR_FAILED and surfaced raw Failed to fetch. Authorized Google/Gmail social access did reach an authenticated dashboard on the Vercel preview host. Password recovery is currently a static support handoff. No personal password or OTP was entered by the agent.",
        "",
        "## 18 Application shell and primary workspace",
        "",
        "Preview shell has a collapsible desktop sidebar, active location, sticky header, theme/language controls, account menu and consistent top-level sections. Mobile navigation is a hamburger/drawer rather than bottom navigation; authenticated mobile was not run, so F-09 remains CANNOT_RETEST. Dashboard is a clear action-center workspace; workout and progress are separate primary workspaces depending on intent.",
        "",
        "## 19 Viewport economy",
        "",
        md_table(["Viewport", "Observed coverage", "Measured note"], [("1920x1080", "Public production", "Rendered cleanly; no horizontal overflow."), ("1440x900", "Public production + preview desktop", "Login card ~471x576; landing extends below fold."), ("1366x768", "Public production", "Route matrix rendered; no horizontal overflow."), ("1024x768", "Public production", "Route matrix rendered; no horizontal overflow."), ("768x1024", "Public production", "Route matrix rendered; no horizontal overflow."), ("430x932", "Public production", "Mobile public representative."), ("390x844", "Public production", "Login card ~132–712; signup ~156–688; landing scroll height ~1720; cookie FAB overlap.")]),
        "",
        "GLOBAL_CHROME_HEIGHT and private workspace heights were not separately instrumented on all viewports. Public auth fits the viewport but uses dead space; private workout mobile is not measured.",
        "",
        "## 20 Visual density and action hierarchy",
        "",
        md_table(["Surface", "CHROME_DENSITY", "CONTROL_DENSITY", "CONTENT_DENSITY", "VISUAL_NOISE"], [("Landing", "Low", "Low", "Medium below fold", "Low-medium; multicolor accents"), ("Auth", "Low", "Medium", "Medium", "Low except cookie FAB"), ("Dashboard preview", "Medium", "Medium-high", "High", "Medium; many action cards"), ("Workout execution preview", "Medium", "High per set", "High", "High risk during exercise; continuous page"), ("Exercise library preview", "Medium", "High filters", "Very high", "High when images unavailable"), ("Progress/nutrition preview", "Medium", "Medium", "High", "Medium")]),
        "",
        "## 21 System states and error recovery",
        "",
        md_table(["STATE", "WHAT_HAPPENS", "UNDERSTOOD", "NEXT_ACTION"], system_states),
        "",
        "## 22 Responsive / light-dark / internationalization",
        "",
        "Public production coverage spans 1920x1080, 1440x900, 1366x768, 1024x768, 768x1024, 430x932 and 390x844. Public dark/light and ES/EN representative states were exercised, with no horizontal overflow. The core private workout mobile matrix is not complete. Light/dark public hierarchy is coherent; charts/exercise images/private dialogs were not both themed. ES/EN JSON leaf-key parity is 369/369, but html lang is hardcoded to es while language state changes visible copy. A11y inspection found named inputs/buttons and labels, but no main/heading landmarks on auth screens. Composed accessibility tools were not available; manual browser/code fallback was used and recorded as a tool gap.",
        "",
        "### Private coverage matrix",
        "",
        md_table(["SURFACE", "PREVIEW DARK", "PREVIEW LIGHT", "PREVIEW ES", "PREVIEW EN", "MOBILE AUTH", "RESULT"], [("Dashboard", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Workout generation", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Workout execution", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Progress", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Nutrition", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Achievements", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY"), ("Exercises", "READONLY_OBSERVED", "NOT_SAVED", "OBSERVED", "NOT_SAVED", "NOT_MEASURED", "PARTIAL_READONLY")]),
        "",
        "## 23 Premium product surface and anti-template",
        "",
        "Impulso has a recognizable fitness direction: copper/orange gradients, branded wave logo, Momentum Fitness language, progress/energy cards and workout-specific content. It does not read as a pure generic SaaS dashboard in the preview. Premium confidence is reduced by the canonical access failure, contact-only recovery, multicolor landing accents, cookie overlap, and dense execution/library surfaces. Preserve the strong hero, shell, rationale cards and clear action center while tightening the token system and workout ergonomics.",
        "",
        "## 24 Historical regression matrix",
        "",
        md_table(["HISTORICAL_ID", "HISTORICAL_TITLE", "OLD_SEVERITY", "OLD_EVIDENCE", "CURRENT_STATUS", "CURRENT_FINDING_ID", "CURRENT_SEVERITY", "CURRENT_EVIDENCE", "CHANGE_CLASS", "NOTES"], historical),
        "",
        "Status interpretation: VERIFIED_FIXED=0; STILL_PRESENT=6; PARTIALLY_FIXED=0 for numbered findings; F-09=CANNOT_RETEST. H-10–H-13 are PARTIALLY_FIXED only as coverage progress (surface existence now observed), not UX fixes; their assessment remains NOT_EVALUATED.",
        "",
        "## 25 Scorecards",
    ]
    for title, rows in [("Application UX", scorecards["application_ux"]), ("Application UI", scorecards["application_ui"]), ("Landing secondary surface", scorecards["landing"])] :
        lines += [f"### {title}", "", md_table(["Dimension", "Rating", "Basis"], rows), ""]
    lines += [
        "Allowed ratings used: EXCELLENT, GOOD, FAIR, POOR, CRITICAL, NOT_EVALUATED, NOT_APPLICABLE. NOT_EVALUATED is used where auth, safety or longitudinal evidence prevents measurement; it is not converted to a penalty.",
        "",
        "## 26 What works well",
        "",
        "- The landing hero communicates fitness transformation quickly and keeps signup/login actions prominent.\n- Auth forms have visible labels, required markers, named social controls and disabled submit behavior.\n- Public theme and language controls visibly change the experience, and translation namespaces have equal leaf-key counts.\n- Protected routes redirect anonymous visitors instead of exposing private content.\n- The preview shell provides a stable active-location model, collapsible sidebar, account menu and persistent preferences.\n- Private surfaces contain useful domain-specific rationale: recommended next action, profile-derived plan reasoning, progress interpretation and nutrition adjustment.\n- Workout execution explicitly offers draft retention and a finish action; progress/nutrition do not merely stop at charts/cards.",
        "",
        "## 27 Product UX findings",
        "",
    ]
    for f in findings:
        if f["finding_scope"] == "PRODUCT_UX": lines += [f"### {f['id']} — {f['title']}", "", finding_md(f), ""]
    lines += ["## 28 Product access findings", ""]
    for f in findings:
        if f["finding_scope"] == "PRODUCT_ACCESS": lines += [f"### {f['id']} — {f['title']}", "", finding_md(f), ""]
    lines += ["## 29 Supporting engineering findings", "", "### ENG-01 — Test baseline depends on generated Prisma client", "", "- **finding_scope**: ENGINEERING_SUPPORT\n- **evidence**: Frontend lint/typecheck/tests/build passed (78 tests; frontend coverage 12.15% statements). Backend typecheck/test initially failed before Prisma generation; `pnpm build` generated the client and passed, then backend `pnpm test:ci` passed 13 suites / 39 tests.\n- **impact**: Reproducibility and test interpretation, not a direct UX finding.\n- **recommendation**: Make generation/install prerequisites explicit in CI and capture coverage thresholds honestly.", "", "No separate EXTERNAL_INFRASTRUCTURE or COMPLIANCE_REVIEW finding is asserted. CORS is represented as PRODUCT_ACCESS UX-01 because it blocks a user task; its deployment configuration cause is documented in the root cause.", "", "## 30 Quick wins", "", md_table(["ID", "CHANGE", "ROADMAP", "LINK", "EFFORT"], quick_wins), "", "## 31 Structural opportunities", "", md_table(["ID", "OPPORTUNITY", "LINK", "ROADMAP", "RATIONALE"], structural), "", "## 32 Recommended roadmap", "", md_table(["Phase", "Focus", "Evidence-led scope"], [("P0 — blockers/access", "Canonical CORS, auth error taxonomy, health/preflight smoke checks", "UX-01, UX-02"), ("P1 — core task completion", "Entry model, recovery flow, social parity", "UX-03, UX-04, UX-07"), ("P2 — error/recovery", "Retry, semantic landmarks, locale metadata, safe overlays", "UX-02, UX-08, UX-09, UX-10"), ("P3 — workout/mobile ergonomics", "Continuous workout workspace, timer/current/next, thumb reach", "F-09/H-11 and CJ-04 mobile gap"), ("P4 — onboarding/AI", "Progressive disclosure, explanation, regeneration, limits", "H-09/H-10"), ("P5 — progress/nutrition", "Periods, comparisons, empty states, write recovery and next action", "H-12/H-13"), ("P6 — premium/polish", "Palette tokens, image completeness, density and motion discipline", "UX-06 and surface quality")]), "", "## 33 DO_NOT_BREAK", "", "\n".join(f"- {x}" for x in do_not_break), "", "## 34 Evidence coverage", "", md_table(["ID", "ENVIRONMENT", "SURFACE", "JOURNEY", "VIEWPORT", "THEME", "LOCALE", "URL", "ACTION", "DESCRIPTION"], [tuple(e.values()) for e in evidence]), "", "Evidence images are stored under `docs/audits/evidence/anclora-impulso-ux-reaudit-2026-09-14/`. No credentials, passwords, OTPs, personal account screenshots or private email content are included.", "", "## 35 Tool compatibility gaps", "", "- CUA browser-provider inventory reported no browser provider, so native Chrome accessibility control was used for the authorized session.\n- The static skill runtime reported v1.4.0 and no real browser coverage; this report does not transform executed/static checks into browser coverage.\n- Dedicated composed accessibility/i18n/design-system/visual-regression tools were not independently callable in this environment. Manual Playwright, CUA accessibility inspection and repository evidence are clearly labeled.\n- No screenshot comparison against the old audit was possible beyond reading the old PDF and current screenshots.", "", "## 36 Limitations and audit integrity", "", "- Canonical production authentication remains blocked by CORS; private browser evidence is therefore from a separately labeled PREVIEW host.\n- Google/Gmail social login was authorized by the user; the agent did not type a password or OTP. The final session displayed existing profile data but no such data was stored in report artifacts.\n- No account creation, OAuth provider cancellation, workout set marking, meal logging, plan generation, deletion, purchase or other write occurred.\n- Staging/preview parity, offline install, service-worker behavior, admin, wearables, premium entitlements and longitudinal progress usefulness are unknown/not evaluated.\n- Scores are not lowered for NOT_EVALUATED dimensions; they are explicitly marked.", "", "## 37 Audit completion gate", "", md_table(["Gate", "Result"], list(gates.items())), "", "## 38 Final comparative answer", "", "1. **¿Mejor, igual o peor que el 06/09?** Mixta, sin mejora neta: la experiencia pública y el host preview tienen más evidencia actual, pero el bloqueo crítico del dominio canónico sigue igual.\n2. **¿Qué se corrigió realmente?** Ningún finding numerado se puede marcar VERIFIED_FIXED. Theme/locale y superficies privadas ahora sí tienen observación parcial en browser, pero eso no es una corrección histórica.\n3. **¿Qué sigue?** F-01, F-02, F-04, F-05, F-06 y F-07 siguen presentes. F-09 no se pudo retestar en móvil autenticado.\n4. **¿Problemas nuevos?** Recovery contact-only, landmarks auth incompletos, cookie FAB solapando landing mobile y html lang desincronizado.\n5. **¿Dominio canónico operativo?** No para autenticación: API health está sano, pero OPTIONS desde el origen canónico devuelve 500.\n6. **¿Tareas core?** Las superficies core renderizan en PREVIEW, pero no se puede afirmar finalización core desde producción canónica; 22/30 tareas están bloqueadas para esta auditoría.\n7. **¿Usable durante entrenamiento móvil?** No demostrado; la ejecución desktop se ve funcional, pero mobile thumb-reach/current/next/timer requiere una prueba dedicada.\n8. **¿IA inspira confianza?** Parcialmente: hay rationale contextual; generación, límites, regeneración y control no se evaluaron.\n9. **¿Progreso/nutrición útiles o decorativos?** Más que decorativos: muestran interpretación y recomendaciones; utilidad longitudinal y writes no se probaron.\n10. **¿Etiqueta premium?** Aspiración premium clara, cumplimiento parcial: acceso, recovery, densidad móvil y coherencia cromática deben subir de nivel.\n11. **¿Siguiente bloque con mayor retorno?** P0 canonical access + error recovery, seguido de una re-auditoría móvil del workout con el dominio ya operativo.", "", "## 39 Suggested handoff", "", "Suggested commit (not created, per AUDIT_ONLY): `docs(impulso): add full UX/UI product re-audit`. No push performed.", ""]
    return "\n".join(lines)

def html_table(headers, rows):
    h = "<thead><tr>" + "".join(f"<th>{esc(x)}</th>" for x in headers) + "</tr></thead>"
    body = "<tbody>" + "".join("<tr>" + "".join(f"<td>{esc(x)}</td>" for x in row) + "</tr>" for row in rows) + "</tbody>"
    return f"<table>{h}{body}</table>"

def build_html(md: str) -> str:
    nav = "".join(f"<a href=\"#{i:02d}\">{i:02d}</a>" for i in range(0, 40))
    cards = "".join(f"<article class='finding'><div class='finding-top'><span class='badge'>{esc(f['id'])}</span><span class='severity {f['severity'].lower()}'>{esc(f['severity'])}</span></div><h3>{esc(f['title'])}</h3><p>{esc(f['evidence'])}</p><dl><dt>Scope</dt><dd>{esc(f['finding_scope'])}</dd><dt>Journey</dt><dd>{esc(f['journey'])}</dd><dt>Priority</dt><dd>{esc(f['priority'])}</dd><dt>Change</dt><dd>{esc(f['change_class'])}</dd></dl></article>" for f in findings)
    shots = "".join(f"<figure><img src='evidence/anclora-impulso-ux-reaudit-2026-09-14/{esc(e['id'])}-{re.sub(r'[^a-z0-9]+','-',e['description'].lower()).strip('-')[:44]}.png' onerror=\"this.style.display='none'\"><figcaption>{esc(e['id'])} · {esc(e['viewport'])} · {esc(e['description'])}</figcaption></figure>" for e in evidence[:7])
    # The images are linked by their actual evidence filenames, not generated descriptions.
    actual = ["E01-landing-es-dark-1440x900.png","E02-landing-es-dark-390x844.png","E03-landing-en-light-1440x900.png","E04-landing-en-light-390x844.png","E05-login-es-dark-390x844.png","E06-signup-es-dark-390x844.png","E07-forgot-password-es-dark-390x844.png"]
    shots = "".join(f"<figure><img src='evidence/anclora-impulso-ux-reaudit-2026-09-14/{fn}'><figcaption>{esc(evidence[i]['id'])} · {esc(evidence[i]['viewport'])} · {esc(evidence[i]['description'])}</figcaption></figure>" for i, fn in enumerate(actual))
    section_blocks = []
    for number, title, content in [
        ("01","Executive assessment",html_table(["Question","Evidence-based answer"], [("BIGGEST_USER_FRICTION","Canonical production authentication is blocked by CORS 500."),("BIGGEST_QUICK_WIN","Allow canonical origin and add OPTIONS smoke test."),("BIGGEST_STRUCTURAL_OPPORTUNITY","Continuous mobile-first workout workspace."),("OVERALL","Mixed, not improved overall versus 06/09." )])),
        ("04","Depth remediation",html_table(["Metric","Previous","Deep remediation"],[("Browser evidence","12","64 observation records"),("Saved screenshots","7","7; file-export gap justified"),("Full journey records","4","20"),("Private surfaces","E12 aggregate","17 CUA observations decomposed")])) ,
        ("04B","Depth gap matrix",html_table(["Area","Gap","Target output"],[(x[0],x[3],x[6]) for x in depth_gap_matrix])),
        ("04C","Depth parity with Talent",html_table(["Field","Value"],list(depth_parity.items()))),
        ("04","Surface classification",html_table(["Field","Result","Source"],[("Primary","APPLICATION","Code + browser"),("Platform","PWA","Manifest; offline unknown"),("Secondary","LANDING_PAGE","Public route"),("Mismatch","YES","Static heuristic said DASHBOARD; override documented")])) ,
        ("05","Current product model",html_table(["Capability","Classification","Evidence"], capabilities)),
        ("06","Promise versus observed",html_table(["Segment","Promise","Observed","Evidence","Confidence"], promise_table)),
        ("07","Task inventory",html_table(["ID","Task","Class","Criticality","Coverage"],tasks)),
        ("08B","Expanded journey registry",html_table(["ID","Journey","Coverage","Evidence","Notes"],[(j["id"],j["name"],j["coverage"],", ".join(j["screenshot_reference"]),j["coverage_notes"]) for j in expanded_journeys])),
        ("08C","Screen map",html_table(["Screen","Purpose","Primary","Entry","Exit","Recovery"],[(x[0],x[1],x[2],x[6],x[7],x[8]) for x in screen_map])),
        ("08D","Experience map",html_table(["Stage","Entry","Goal","Action","Response","Friction","Result"],experience_map)),
        ("19","Viewport economy",html_table(["Viewport","Coverage","Measured note"],[("1920x1080","Public","Clean; no horizontal overflow"),("1440x900","Public + preview","Login card ~471x576"),("1366x768","Public","Clean route matrix"),("1024x768","Public","Clean route matrix"),("768x1024","Public","Clean route matrix"),("430x932","Public","Mobile representative"),("390x844","Public","Auth dead space; cookie overlap")])) ,
        ("24","Historical regression matrix",html_table(["ID","Status","Current evidence"],[(x[0],x[4],x[7]) for x in historical])),
        ("25","Scorecards",html_table(["Dimension","Rating","Basis"],scorecards["application_ux"]+scorecards["application_ui"]+scorecards["landing"])),
        ("30","Quick wins",html_table(["ID","Change","Phase","Link","Effort"],quick_wins)),
        ("31","Structural opportunities",html_table(["ID","Opportunity","Link","Phase","Rationale"],structural)),
        ("34","Evidence coverage",html_table(["ID","Environment","Surface","Journey","Viewport","Theme","Locale","URL","Action","Description"],[tuple(e.values()) for e in evidence])),
        ("36","Audit integrity", "<p>Canonical auth is blocked, so private browser evidence is labeled PREVIEW. No secrets or writes were stored or performed. NOT_EVALUATED is not converted into a negative score. Static/tool outputs are not treated as browser coverage.</p>"),
    ]:
        section_blocks.append(f"<section id='{number}'><h2>{number} {esc(title)}</h2>{content}</section>")
    section_blocks.append(f"<section id='36'><h2>36 Product UX findings</h2><div class='finding-grid'>{cards}</div></section>")
    section_blocks.append(f"<section id='38'><h2>38 What works well / DO_NOT_BREAK</h2><ul>{''.join(f'<li>{esc(x)}</li>' for x in do_not_break)}</ul><h2>Final comparative answer</h2><p><strong>Mixed, no net improvement.</strong> Public and preview surfaces are materially observable, but canonical access remains critically blocked. The next highest-return block is canonical access/error recovery, followed by mobile workout execution.</p></section>")
    return f"""<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Anclora Impulso UX/UI Product Re-Audit 2026</title><style>
    :root{{--ink:#132038;--muted:#61708a;--orange:#ef7b35;--rose:#f43f75;--navy:#061126;--line:#d9e0ea;--soft:#f4f7fb;--critical:#b42318;--high:#c2410c;--good:#0f766e}}
    *{{box-sizing:border-box}}body{{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--ink);background:#eef2f7;line-height:1.48}}.page{{max-width:1320px;margin:auto;background:white;box-shadow:0 0 50px #0b17331c}}header.cover{{min-height:600px;padding:70px 78px;color:white;background:radial-gradient(circle at 70% 15%,#ef7b3588,transparent 28%),linear-gradient(135deg,#050b1c,#0b1734 65%,#27152a)}}header.cover .kicker{{letter-spacing:.25em;text-transform:uppercase;color:#ffb27d;font-size:12px;font-weight:700}}h1{{font-size:56px;line-height:1.02;max-width:800px;margin:34px 0 24px}}header.cover p{{font-size:20px;max-width:700px;color:#d8e0ef}}.meta-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:55px}}.meta{{border:1px solid #ffffff22;background:#ffffff10;border-radius:14px;padding:14px}}.meta b{{display:block;font-size:11px;color:#ffbc8d;text-transform:uppercase;letter-spacing:.1em}}.meta span{{display:block;margin-top:4px;font-size:14px}}.nav{{position:sticky;top:0;z-index:4;background:#061126;color:white;padding:12px 78px;display:flex;gap:7px;flex-wrap:wrap}}.nav a{{color:#b8c4da;text-decoration:none;padding:5px 9px;border-radius:7px;font-size:12px}}.nav a:hover{{background:#ffffff18;color:white}}main{{padding:34px 78px 90px}}section{{scroll-margin-top:62px;margin:0 0 46px}}h2{{font-size:28px;margin:0 0 16px;border-bottom:2px solid var(--orange);padding-bottom:8px}}h3{{font-size:18px;margin:10px 0}}p{{color:#33445e}}table{{border-collapse:collapse;width:100%;margin:14px 0 20px;font-size:12px}}th{{background:#0b1933;color:#fff;text-align:left;padding:9px;vertical-align:top}}td{{border:1px solid var(--line);padding:8px;vertical-align:top}}tr:nth-child(even) td{{background:var(--soft)}}.finding-grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}}.finding{{border:1px solid var(--line);border-radius:16px;padding:18px;background:linear-gradient(180deg,#fff,#f7f9fc)}}.finding-top{{display:flex;justify-content:space-between;align-items:center}}.badge{{font-weight:800;color:var(--orange)}}.severity{{font-size:11px;text-transform:uppercase;border-radius:20px;padding:3px 8px;background:#dce7f3}}.severity.critical{{background:#fee4e2;color:var(--critical)}}.severity.high{{background:#ffedd5;color:var(--high)}}.finding p{{font-size:13px}}dl{{display:grid;grid-template-columns:90px 1fr;font-size:12px;margin:12px 0 0}}dt{{font-weight:700;color:var(--muted)}}dd{{margin:0;color:#33445e}}figure{{margin:0 0 22px;border:1px solid var(--line);border-radius:12px;padding:8px;background:#fafbfd}}figure img{{display:block;width:100%;height:auto;border-radius:8px}}figcaption{{font-size:11px;color:var(--muted);padding:7px 2px 2px}}.shot-grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}}.callout{{border-left:5px solid var(--orange);background:#fff7ed;padding:16px;border-radius:8px}}footer{{background:#061126;color:#c5d0e2;padding:28px 78px;font-size:12px}}@media print{{.nav{{display:none}}.shot-grid{{display:block}}.shot-grid figure{{display:block;break-inside:avoid;page-break-inside:avoid}}.shot-grid figure img{{max-height:105mm;width:auto;max-width:100%;object-fit:contain}}section{{break-inside:auto}}table{{break-inside:auto}}}}@media(max-width:800px){{header.cover,main,footer{{padding-left:22px;padding-right:22px}}h1{{font-size:40px}}.meta-grid,.finding-grid,.shot-grid{{grid-template-columns:1fr}}.nav{{padding:10px 16px}}table{{font-size:10px;display:block;overflow-x:auto;white-space:normal}}}}
    </style></head><body><div class='page'><header class='cover'><div class='kicker'>Anclora Impulso · Product research</div><h1>UX/UI Product Re-Audit 2026</h1><p>Current product, current code, current deployment, current browser, current findings.</p><div class='meta-grid'><div class='meta'><b>Date / status</b><span>2026-09-14 · PASS_WITH_GAPS</span></div><div class='meta'><b>Audited head</b><span>65e655e · development</span></div><div class='meta'><b>Skill</b><span>1.5.0 contract / 1.4.0 runtime</span></div><div class='meta'><b>Surface</b><span>APPLICATION + LANDING_PAGE</span></div><div class='meta'><b>Canonical</b><span>impulso.anclora.com</span></div><div class='meta'><b>Browser env</b><span>PRODUCTION + PREVIEW</span></div><div class='meta'><b>Historical</b><span>13 declared / 7 numbered</span></div><div class='meta'><b>Findings</b><span>10 material / 4 new</span></div></div></header><nav class='nav'>{nav}</nav><main>{''.join(section_blocks)}<section id='evidence'><h2>Evidence screenshots</h2><div class='shot-grid'>{shots}</div></section></main><footer>Audit-only artifact · No product code, backend, database, environment or deployment changes made. Suggested commit: docs(impulso): add full UX/UI product re-audit</footer></div></body></html>"""

def para(text, style):
    return Paragraph(esc(text).replace("\n", "<br/>"), style)

def build_pdf(md: str) -> None:
    path = OUT / f"{STEM}.pdf"
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=colors.white, alignment=TA_LEFT, spaceAfter=12))
    styles.add(ParagraphStyle(name="CoverSmall", parent=styles["Normal"], fontSize=10, leading=14, textColor=colors.HexColor("#d8e0ef")))
    styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontSize=16, leading=20, textColor=colors.HexColor("#0b1933"), spaceBefore=12, spaceAfter=8))
    styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=8.3, leading=11.2, textColor=colors.HexColor("#33445e"), spaceAfter=5))
    styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=6.2, leading=7.6, textColor=colors.HexColor("#33445e")))
    styles.add(ParagraphStyle(name="FindingTitle", parent=styles["Heading3"], fontSize=10, leading=12, textColor=colors.HexColor("#0b1933"), spaceAfter=4))
    story = []
    story += [Spacer(1, 28*mm), Paragraph("ANCLORA IMPULSO · PRODUCT RESEARCH", ParagraphStyle("K", parent=styles["CoverSmall"], textColor=colors.HexColor("#ffb27d"))), Spacer(1, 12*mm), Paragraph("UX/UI Product Re-Audit 2026", styles["CoverTitle"]), Paragraph("Current product · current code · current deployment · current browser · current findings", styles["CoverSmall"]), Spacer(1, 18*mm)]
    cover_rows = [["DATE / STATUS", "HEAD / BRANCH", "SKILL", "SURFACE"], ["2026-09-14 · PASS_WITH_GAPS", "65e655e · development", "1.5.0 / 1.4.0 runtime", "APPLICATION + LANDING_PAGE"], ["CANONICAL", "BROWSER ENV", "OLD BASELINE", "FINDINGS"], ["impulso.anclora.com", "PRODUCTION + PREVIEW", "13 declared / 7 numbered", "10 material / 4 new"]]
    t = Table([[Paragraph(esc(c), styles["Smallx"]) for c in row] for row in cover_rows], colWidths=[43*mm]*4)
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#203456")),("TEXTCOLOR",(0,0),(-1,0),colors.HexColor("#ffbd91")),("BACKGROUND",(0,1),(-1,-1),colors.HexColor("#ffffff12")),("BOX",(0,0),(-1,-1),.4,colors.HexColor("#ffffff33")),("INNERGRID",(0,0),(-1,-1),.25,colors.HexColor("#ffffff22")),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),7)]))
    story += [t, PageBreak()]
    story += [Paragraph("Index and executive assessment", styles["H2x"]), Paragraph("This document reconciles the 2026-09-06 historical baseline with fresh production and preview browser evidence. Canonical authentication is still blocked by CORS; private preview observations are therefore explicitly labeled PREVIEW.", styles["Bodyx"]), Spacer(1, 3*mm)]
    summary_rows = [["QUESTION","ANSWER"], ["BIGGEST FRICTION","Canonical origin preflight 500 prevents production authentication."], ["BIGGEST QUICK WIN","Admit canonical origin in CORS; map network failure to retryable localized state."], ["BIGGEST STRUCTURAL","Continuous mobile-first workout execution workspace."], ["COMPARATIVE","Mixed, no net improvement overall versus 06/09."]]
    st = Table([[Paragraph(esc(c), styles["Smallx"]) for c in row] for row in summary_rows], colWidths=[44*mm,126*mm])
    st.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#0b1933")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.3,colors.HexColor("#d9e0ea")),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),6)]))
    story += [st, PageBreak()]
    def add_table(headers, rows, widths=None):
        data = [[Paragraph(esc(x), styles["Smallx"]) for x in headers]] + [[Paragraph(esc(x), styles["Smallx"]) for x in row] for row in rows]
        tb = Table(data, colWidths=widths, repeatRows=1)
        tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#0b1933")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.25,colors.HexColor("#d9e0ea")),("BACKGROUND",(0,1),(-1,-1),colors.HexColor("#f7f9fc")),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),4)]))
        story.append(tb); story.append(Spacer(1, 4*mm))
    story += [Paragraph("Method, provenance and product model", styles["H2x"]), Paragraph("Contractual skill: v1.5.0. Manifest/runtime: v1.4.0. This discrepancy is documented, and the current contractual SKILL.md wins. Static runtime is partial; browser evidence came from Playwright in production and native Chrome accessibility control in an authorized preview session.", styles["Bodyx"])]
    add_table(["CAPABILITY","CLASSIFICATION","OBSERVED EVIDENCE"], capabilities, [39*mm,34*mm,97*mm])
    story += [Paragraph("Promise versus observed experience", styles["H2x"])]
    add_table(["SEGMENT","PROMISE","OBSERVED","EVIDENCE","CONF."], promise_table, [24*mm,39*mm,61*mm,24*mm,18*mm])
    story.append(PageBreak())
    story += [Paragraph("Tasks, journeys and fitness execution", styles["H2x"])]
    add_table(["ID","TASK","CLASS","CRIT.","COVERAGE"], tasks, [10*mm,48*mm,35*mm,22*mm,22*mm])
    story += [Paragraph("30 tasks: 4 covered, 4 partial, 22 blocked. ‘Covered’ means materially observed; code presence alone is not coverage.", styles["Bodyx"])]
    for j in journeys:
        story += [Paragraph(f"{j['id']} · {j['name']}", styles["H2x"])]
        rows = [(k, ", ".join(v) if isinstance(v, list) else v) for k, v in j.items() if k not in {"id","name"}]
        add_table(["FIELD","OBSERVATION"], rows, [42*mm,128*mm])
    story.append(PageBreak())
    story += [Paragraph("Historical reconciliation", styles["H2x"])]
    add_table(["ID","STATUS","CURRENT EVIDENCE"], [(x[0],x[4],x[7]) for x in historical], [22*mm,32*mm,116*mm])
    story += [Paragraph("The old PDF declared 13 findings but enumerated seven numbered cards. Six explicitly described open/blocked items are retained as H-08–H-13 and remain NOT_EVALUATED; no false fix or regression is asserted.", styles["Bodyx"]), PageBreak(), Paragraph("Current findings", styles["H2x"])]
    for f in findings:
        story += [Paragraph(f"{f['id']} · {f['title']}", styles["FindingTitle"]), Paragraph(f"{f['severity']} · {f['finding_scope']} · {f['priority']} · {f['change_class']}", styles["Smallx"]), Paragraph(f["evidence"], styles["Bodyx"]), Paragraph(f"<b>Recommended change:</b> {esc(f['recommended_change'])}", styles["Bodyx"]), HRFlowable(width="100%", thickness=.3, color=colors.HexColor("#d9e0ea")), Spacer(1,2*mm)]
    story.append(PageBreak())
    story += [Paragraph("Scorecards and roadmap", styles["H2x"])]
    add_table(["DIMENSION","RATING","BASIS"], scorecards["application_ux"] + scorecards["application_ui"] + scorecards["landing"], [42*mm,28*mm,100*mm])
    add_table(["ID","QUICK WIN","PHASE","LINK","EFFORT"], quick_wins, [18*mm,77*mm,18*mm,18*mm,24*mm])
    add_table(["ID","OPPORTUNITY","LINK","PHASE","RATIONALE"], structural, [18*mm,55*mm,25*mm,18*mm,39*mm])
    story.append(PageBreak())
    story += [Paragraph("Evidence screenshots", styles["H2x"])]
    actual = ["E01-landing-es-dark-1440x900.png","E02-landing-es-dark-390x844.png","E03-landing-en-light-1440x900.png","E04-landing-en-light-390x844.png","E05-login-es-dark-390x844.png","E06-signup-es-dark-390x844.png","E07-forgot-password-es-dark-390x844.png"]
    for i, fn in enumerate(actual):
        fp = EVIDENCE_DIR / fn
        if fp.exists():
            im = Image(str(fp)); im._restrictSize(168*mm, 90*mm)
            story += [im, Paragraph(f"{evidence[i]['id']} · {evidence[i]['viewport']} · {evidence[i]['description']}", styles["Smallx"]), Spacer(1, 4*mm)]
            if i in {1,3,5}: story.append(PageBreak())
    story += [Paragraph("Final comparative answer", styles["H2x"]), Paragraph("Impulso is not better overall than 06/09: current public and preview surfaces are richer and now browser-observable, but the same critical canonical access failure remains. The highest-return next block is production CORS/auth recovery, then a focused mobile workout execution audit.", styles["Bodyx"])]
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=17*mm, bottomMargin=17*mm, title="Anclora Impulso UX/UI Product Re-Audit 2026", author="Codex")
    def footer(canvas, doc):
        canvas.saveState(); canvas.setFont("Helvetica", 7); canvas.setFillColor(colors.HexColor("#61708a")); canvas.drawString(20*mm, 9*mm, "Anclora Impulso · UX/UI Product Re-Audit · audit-only"); canvas.drawRightString(190*mm, 9*mm, f"{doc.page}"); canvas.restoreState()
    def first(canvas, doc):
        canvas.saveState(); canvas.setFillColor(colors.HexColor("#061126")); canvas.rect(0,0,A4[0],A4[1],fill=1,stroke=0); canvas.restoreState()
    # Cover background is only used for the first page; subsequent pages use footer.
    doc.build(story, onFirstPage=first, onLaterPages=footer)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    md = build_markdown()
    (OUT / f"{STEM}.md").write_text(md, encoding="utf-8")
    html_doc = build_html(md)
    (OUT / f"{STEM}.html").write_text(html_doc, encoding="utf-8")
    browser_inventory = []
    observation_path = Path("/tmp/impulso-browser-results.json")
    if observation_path.exists():
        try:
            raw_observations = json.loads(observation_path.read_text(encoding="utf-8"))
            for index, obs in enumerate(raw_observations, start=1):
                browser_inventory.append({"id": f"PW-{index:02d}", "environment": "PRODUCTION", "route": obs.get("route"), "viewport": obs.get("viewport"), "status": obs.get("status"), "title": obs.get("title"), "heading_count": len(obs.get("h1", [])) + len(obs.get("h2", [])), "visible_count": obs.get("visibleCount"), "overflow_x": obs.get("overflowX"), "errors": obs.get("errors", []), "page_errors": obs.get("pageErrors", [])})
        except (OSError, json.JSONDecodeError):
            browser_inventory = []
    payload = {"metadata": metadata, "depth_parity_with_talent": depth_parity, "evidence": evidence, "cua_observations": cua_observations, "playwright_observation_inventory": browser_inventory, "capabilities": capabilities, "promise_vs_observed": promise_table, "user_types": users, "tasks": tasks, "critical_journeys": journeys, "expanded_journeys": expanded_journeys, "screen_map": screen_map, "experience_map": experience_map, "depth_gap_matrix": depth_gap_matrix, "findings": findings, "historical_matrix": historical, "scorecards": scorecards, "system_states": system_states, "quick_wins": quick_wins, "structural_opportunities": structural, "do_not_break": do_not_break, "gates": gates, "limitations": ["Canonical production auth CORS block", "No E2E credentials stored", "No writes performed", "Private mobile workout not fully covered", "Offline/admin/wearables/premium longitudinal behavior unknown", "Native CUA session could not export sanitized screenshots while Playwright could not share its cookies"]}
    (OUT / f"{STEM}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / f"{STEM}-evidence-index.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    # PDF is rendered from the generated HTML with Chromium by the companion
    # renderer. Keeping the render step separate avoids adding a PDF runtime
    # dependency to the audit data builder.
    print(json.dumps({"markdown":str(OUT/f'{STEM}.md'),"html":str(OUT/f'{STEM}.html'),"json":str(OUT/f'{STEM}.json'),"pdf":str(OUT/f'{STEM}.pdf'),"evidence":str(EVIDENCE_DIR)}, indent=2))

if __name__ == "__main__":
    main()
