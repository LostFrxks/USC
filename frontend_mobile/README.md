# USC Mobile

Buyer-first mobile client for USC, built in `frontend_mobile/`.

## Setup

1. Create `.env` from `.env.example`
2. Install dependencies:

```powershell
npm install --legacy-peer-deps
```

3. Run typecheck:

```powershell
npm run typecheck
```

4. Start Expo:

```powershell
npm start
```

## Current scope

- email/password login
- phone + code login
- buyer registration with email code
- buyer registration with phone code
- auth guard UX with cooldowns and lockout/captcha-aware messaging
- password reset request/confirm by email code
- session bootstrap with refresh token
- active company resolution for buyer and supplier companies
- buyer home catalog + supplier drill-in
- supplier workspace with inbox/outbox, deliveries and searchable/filterable publications
- cart + checkout with current-location, manual coordinates and in-app map picker
- buyer and supplier order detail flows with journey timeline, totals and inline delivery status controls
- notifications
- profile + company switch + profile edit including courier availability toggle
- mobile onboarding guide with replay/restart support
- analytics dashboard with visual trend, funnel and category breakdown cards
- AI chat sessions with streaming replies, assistant metric cards and fallback query mode
- visual what-if simulation with month focus, presets, horizon/drilldown controls, scenario theater insight cards, cascade/money-flow/acts blocks, compare/drilldown cards and saved scenarios
- analytics-to-AI handoff from trend cards with month-focused prompts
- role-aware operational help hub with workflow shortcuts and AI support handoff
- searchable FAQ and service center actions wired into workflow + AI routes
- grouped workspace/company switcher with search and buyer/supplier summary
- searchable orders dashboard with summary cards and stronger buyer/supplier inbox filtering
- shared business UI primitives rolled out across major workspace screens for more native product consistency
- new shared mobile business template applied across buyer-critical flows including home, orders, notifications, cart and order detail
- same shared mobile business template extended to supplier operations and service-center screens
- same shared mobile business template now covers essentially the full mobile screen set, including auth and supplier-catalog entry flows
- core mobile primitives (`TextField`, empty/loading states, product cards and modals) now follow the same new template
- shared action-card primitives now drive quick actions and service entry cards across the app
- home supplier/buyer discovery surfaces now also use the same action-card language for faster scanning
- shared data-row patterns now drive dense analytics and notifications surfaces as well
- shared message and action-card patterns now unify support, AI, home hub, and service entry flows
- AI session and saved-scenario management now also use the same shared action-card system
- residual local demo/courier selection cards have been collapsed into the same shared template patterns
- AI and what-if metrics now use the same shared stat-tile language as the rest of the app
- floating rounded tab chrome now matches the new mobile product template as well
- modal and sheet surfaces now share the same elevated mobile sheet language
- global screen ambience and scroll ergonomics now reinforce the same mobile product atmosphere everywhere
- auth and profile-edit flows now use more natural scroll behavior for small-screen/keyboard usage

## Demo shortcuts

The login screen includes one-tap demo shortcuts for seeded accounts:

- `buyer1@usc.demo` / `demo123456`
- `buyer2@usc.demo` / `demo123456`
- `supplier1@usc.demo` / `demo123456`
- `supplier2@usc.demo` / `demo123456`

These shortcuts exist to speed up manual smoke checks and Maestro automation.

## Maestro golden flows

Current smoke/golden scenarios:

- `.maestro/buyer-smoke.yaml`
- `.maestro/supplier-smoke.yaml`
- `.maestro/auth-reset-smoke.yaml`
- `.maestro/onboarding-smoke.yaml`

If Maestro CLI is installed globally, you can run:

```powershell
npm run maestro:buyer
npm run maestro:supplier
npm run maestro:auth-reset
npm run maestro:onboarding
npm run maestro:golden
```

These flows are wired to the mobile `testID` surface across buyer checkout/order history, supplier SKU management, password reset, and onboarding replay routes.

## Validation

```powershell
npm run typecheck
npm test -- --runInBand
```
