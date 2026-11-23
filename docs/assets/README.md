# teamorbit logo

[teamorbit.svg](teamorbit.svg) is the SVG master. An off-white ring and a short
teal arc form an orbital O on a charcoal tile. The app pairs the mark with
a lowercase Geist wordmark.

- Charcoal tile `#10201F`
- Off-white ring `#F4FAF8`
- Teal arc `#43DEC0`
- Use the square 64 × 64 artwork at 16 px or larger.

When updating the master, copy it unchanged to `web/public/favicon.svg` and
`api/src/assets/brand/favicon.svg`. The web app uses its public copy for the
favicon and interface. Nest copies its asset into the API build. Swagger embeds
it as a data URL so the docs favicon works without a separate asset request.
The root README and documentation index reference the master directly.
