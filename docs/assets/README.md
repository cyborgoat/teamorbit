# teamorbit logo

[teamorbit.svg](teamorbit.svg) is the SVG master: an orbital O and three team
members on a deep teal tile. The fixed background keeps the mark legible on
light and dark surfaces. It uses only vector geometry, with no fonts, filters,
external resources, or raster images.

- Tile: `#155E58`
- Orbit and center: `#F0FDFA`
- Outer members: `#85E3C4`
- Canvas: 64 × 64; use at 16 px or larger and preserve its square aspect ratio.

When updating the master, copy it unchanged to `web/public/favicon.svg` and
`api/src/assets/brand/favicon.svg`. The web app uses its public copy for the
favicon and interface. Nest copies its asset into the API build; Swagger embeds
it as a data URL so the docs favicon works without a separate asset request.
The root README and documentation index reference the master directly.
