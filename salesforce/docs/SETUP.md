# Setup guide: connect Salesforce to the Mylapore restaurant API

The Salesforce metadata was previously deployed to the `YatraBus` org. Use these steps to configure the live API connection and repeat deployment when needed.

## 0. What you need
- The restaurant backend (`../backend`) with its PostgreSQL database.
- A **public HTTPS URL** that reaches the backend. Salesforce's cloud cannot call `localhost:4000`.
- A Salesforce org with Agentforce enabled, and the Salesforce CLI (`sf`) logged in to it.
- Node 20+ (for the helper script and unit tests).

## 1. Backend: enable the Salesforce API
The new endpoints live under `/api/v1/agent/*` and are protected by an API key.

1. Set `AGENT_API_KEY` in your local `backend/.env` file (that file is ignored by Git). Keep it secret. To generate a new one: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
2. Set `PUBLIC_ASSET_URL` to the public URL of the website/CDN that serves dish photos (used to build absolute image links). Locally it is `http://localhost:3000`, which Salesforce cannot show.
3. Restart the API. Check it:
   ```bash
   curl -s -H "x-api-key: YOUR_KEY" http://localhost:4000/api/v1/agent/config
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/agent/menu    # must print 401 without the key
   ```
4. Run the backend's own checks: `cd backend && node test/agent-api.e2e.mjs` (52 checks).

## 2. Make the backend reachable from Salesforce (HTTPS)
**For testing**, use a tunnel. Either works:
```bash
# Cloudflare Tunnel (free, no account needed for quick tunnels)
cloudflared tunnel --url http://localhost:4000
# or ngrok
ngrok http 4000
```
Copy the `https://....` URL it prints. A quick tunnel's address changes every run, so you must repeat step 3 each time.

**For production**, deploy the backend on an HTTPS host in India (for example AWS Mumbai or Azure Central India) with a stable domain, and set `PUBLIC_ASSET_URL` to your public site.

Also allow your public host in the backend's `CORS_ORIGINS` only if a browser calls it directly. Salesforce calls are server-to-server, so CORS does not matter for them.

## 3. Salesforce: point the metadata at your host
```bash
cd salesforce
node scripts/configure-endpoint.mjs https://YOUR-PUBLIC-HOST            # same host for the API and the images
node scripts/configure-endpoint.mjs https://api.example.com --images https://cdn.example.com   # different image host
```
This sets the Named Credential URL to `https://YOUR-PUBLIC-HOST/api/v1` and activates the CSP trusted site so dish photos can display. (It refuses `localhost` and plain `http`.)

## 4. Deploy to a Salesforce org
(Already done for the `YatraBus` org on 2026-11-11. Re-run it after changing the endpoint in step 3: `sf project deploy start --target-org YatraBus --metadata NamedCredential:Restaurant_API`.)
Log in once (pick any alias):
```bash
sf org login web --alias mylapore --instance-url https://login.salesforce.com
```
**Validate first** (a check-only deployment: it compiles everything and runs the Apex tests, but changes nothing in the org):
```bash
sf project deploy start --source-dir force-app --target-org mylapore --dry-run --test-level RunSpecifiedTests \
  --tests RestaurantApiServiceTest --tests RestaurantActionsTest --tests RestaurantControllersTest
```
If that passes, deploy for real:
```bash
sf project deploy start --source-dir force-app --target-org mylapore --test-level RunSpecifiedTests \
  --tests RestaurantApiServiceTest --tests RestaurantActionsTest --tests RestaurantControllersTest
```
(Production orgs require tests; a Developer Edition org does not, but running them is good practice.)

## 5. Store the API key (this cannot be deployed: secrets are never in metadata)
Setup → **Named Credentials** → **External Credentials** tab → **Restaurant API** →
1. Under **Principals**, open **RestaurantApiPrincipal** → **Authentication Parameters** → **Add** → name `ApiKey`, value = your `AGENT_API_KEY`. Save.
2. Confirm the **Custom Headers** section shows header `x-api-key` with value `{!$Credential.Restaurant_API.ApiKey}`. (If the deploy did not create it, add it exactly like that, sequence 1.)

## 6. Permissions
```bash
sf org assign permset --name Restaurant_API_Access --target-org mylapore                 # yourself, to test
```
Also assign **Restaurant API Access** to the user the agent runs as (Setup → Users → search "Einstein Agent User" or the agent's configured user). Without it every action fails with an authorisation error.

## 7. Check the connection from Salesforce
```bash
cat > /tmp/check.apex <<'EOF'
RestaurantConfigResponse c = RestaurantApiService.getConfig();
System.debug('tax=' + c.taxPercent + ' fee=' + c.deliveryFee + ' options=' + c.fulfilmentOptions);
RestaurantMenuResponse m = RestaurantApiService.getMenu(null, null, null, false);
System.debug('dishes=' + m.totalItems);
EOF
sf apex run --file /tmp/check.apex --target-org mylapore
```
Expect `dishes=` to match the website's menu. If it errors, see Troubleshooting.

## 8. Add the ordering component to Salesforce
- **App Builder:** Setup → Lightning App Builder → New → App Page → drag **Restaurant Ordering** onto it → Save → Activate.
- **Or a tab:** Setup → Tabs → Lightning Component Tabs → New → choose `c:restaurantOrdering`.
- Dish photos need the CSP trusted site (step 3). If photos show as broken images, check Setup → CSP Trusted Sites.

## 9. Create the agent
Use `docs/AGENTFORCE_BUILDER_PROMPT.md` (a ready-to-paste prompt for Claude in Chrome), or follow it by hand.

## Troubleshooting
| Symptom | Likely cause and fix |
|---|---|
| `UNREACHABLE` ("could not be reached") | The tunnel stopped or its URL changed. Re-run step 3 and redeploy the Named Credential. |
| `UNAUTHORIZED` ("not authorised") | The `ApiKey` parameter is missing/wrong in the External Credential, or does not match `AGENT_API_KEY`. |
| "You do not have access to the Apex class" / credential error | The running user lacks the **Restaurant API Access** permission set. |
| `Unable to find external credential principal` | Permission set not assigned, or the principal name was changed. |
| Photos are broken in the LWC | CSP trusted site not active for the image host, or `PUBLIC_ASSET_URL` is still `localhost`. |
| Agent shows raw text instead of cards | The action output is not mapped to a custom Lightning Type, or the channel folder does not match (see docs/LIGHTNING_TYPES.md). |
| Order says `ITEM_UNAVAILABLE` | A dish was switched off in the restaurant system. The LWC and agent show which one; choose again. |

## Limitations (honest list)
- The restaurant menu has **no subcategories and no structured customization options**. The Apex types and the LWC support them and they appear automatically if the backend adds them. Today, customization is free-text notes per ordered item.
- Ingredients and allergens in the database are **drafts** until the kitchen confirms them.
- Refunds are **not automatic**: cancelling a paid online order flags `REFUND_REQUIRED` for staff.
- Online payment runs on the restaurant's hosted payment page. The agent and LWC give the customer a link; neither takes card details.
