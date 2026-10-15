# n8n-nodes-fxmacrodata

n8n nodes for [FXMacroData](https://fxmacrodata.com/?utm_source=github&utm_medium=referral&utm_campaign=n8n-nodes-fxmacrodata&utm_content=readme):
official central-bank and statistics-agency releases, economic calendars, FX rates,
CFTC positioning and commodities for 22 currencies.

The package contains two nodes:

- **FXMacroData** pulls data into a workflow. It can also be attached to an n8n AI Agent as a tool.
- **FXMacroData Trigger** starts a workflow when a new economic release is recorded, for example a US CPI print or an RBA rate decision.

## Installation

In n8n, open **Settings > Community Nodes**, choose **Install**, and enter:

```
n8n-nodes-fxmacrodata
```

For self-hosted n8n without the UI installer, follow the
[community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

USD data works without an API key, so you can build and test a workflow before you
subscribe. Free USD releases are delivered 15 minutes after publication.

For every other currency, FX rates, commodities and real-time releases:

1. Subscribe at [fxmacrodata.com/subscribe](https://fxmacrodata.com/subscribe?utm_source=github&utm_medium=referral&utm_campaign=n8n-nodes-fxmacrodata&utm_content=subscribe).
2. Copy your API key from your account page.
3. In n8n, create an **FXMacroData API** credential and paste the key. n8n checks it when you save.

The key is sent in the `X-API-Key` header.

## Operations

| Resource | Operation | What it returns |
|---|---|---|
| Announcement | Get History | Release history of one indicator (inflation, policy_rate, non_farm_payrolls, ...) |
| Announcement | Get Latest | Latest release of every indicator for a currency |
| Economic Calendar | Get Events | Scheduled release dates and times, filterable by indicator and date |
| FX Rate | Get Rates | Daily rates for any pair of the 22 currencies |
| COT Positioning | Get Reports | Weekly CFTC Commitments of Traders, legacy, TFF and disaggregated |
| Commodity | Get History / Get Latest | Gold, silver, platinum, WTI, Brent, natural gas, EIA inventories |
| Data Catalogue | Get Indicators | Indicators published for a currency, with units, frequency and source |
| Press Release | Get Many | Official central-bank and agency press releases |
| Market Session | Get Status | Which FX sessions are open and how they overlap |
| Risk Sentiment | Get History | Daily global risk-sentiment composite |

The indicator list in **Announcement > Get History** is loaded from the live data
catalogue for the chosen currency, so new series appear without a node update.

By default each data row becomes its own n8n item, with the currency and indicator
added. Set **Output** to **Full Response** to get the whole API response, including
source and provenance metadata, as one item.

Supported currencies: AUD, BRL, CAD, CHF, CNH, CNY, DKK, EUR, GBP, HUF, ILS, JPY,
KRW, MYR, NGN, NOK, NZD, PEN, SEK, THB, TWD, USD.

## Trigger

**FXMacroData Trigger** polls the release change feed on the schedule you set and
emits one item per new release. Filter by currencies and indicator slugs, and choose
a compact payload (headline figure) or the full stored row.

When the workflow is activated the trigger starts from that moment and does not
replay older releases. A manual test run returns a few releases from the past week
so you can map fields.

## Example workflows

- When a new US CPI release arrives, post the actual figure to Slack.
- Every morning, read today's calendar for EUR, GBP and USD and send it by email.
- Every Saturday, append the latest CFTC positioning for each G10 currency to Google Sheets.
- Give an AI Agent the FXMacroData tool so it can answer "what did the RBA decide last?" from source data.

## Compatibility

Built with `@n8n/node-cli`. The package has no runtime dependencies.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [FXMacroData API reference](https://fxmacrodata.com/documentation/reference?utm_source=github&utm_medium=referral&utm_campaign=n8n-nodes-fxmacrodata&utm_content=docs)

## License

[MIT](LICENSE.md)
