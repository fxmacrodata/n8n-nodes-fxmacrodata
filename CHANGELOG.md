# Changelog

## 0.2.0

- Rebuilt on the n8n node CLI. Resources: Announcement, Economic Calendar, FX Rate, COT Positioning, Commodity, Data Catalogue, Press Release, Market Session, Risk Sentiment.
- New FXMacroData Trigger: starts a workflow when a new economic release is recorded.
- All 22 supported currencies; the indicator list loads from the live data catalogue.
- The API key is sent in the `X-API-Key` header, and the credential test checks it.
- The API key is optional: USD data, the catalogue, market sessions and risk sentiment work without one.
- The node can be used as a tool by the n8n AI Agent.
