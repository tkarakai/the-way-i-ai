# Accessibility

I want anyone to be able to read this site comfortably, whatever device, settings, or assistive technology they use.

## What I aim for

The site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, in both designs, Field Atlas and Folio.

Under the decoration, every page is plain HTML: real headings, lists, links, and buttons. Screen readers, keyboard navigation, zoom, and your browser’s reading tools should work the way you expect. The full text is readable without JavaScript, and everything works offline once a page has loaded.

## Your device settings come first

You shouldn’t have to configure the same thing on every website, so the site follows what you have already set on your device:

- **Reduce motion:** animations, page entrances, and the logo’s little tricks stay off, and nothing moves on its own.
- **Contrast themes** (such as Windows High Contrast): pages use your colours, and selected buttons and the current section stay distinguishable.
- **Light or dark:** the theme follows your device until you choose otherwise.
- **Zoom and text size:** pages reflow down to a 320-pixel-wide screen without sideways scrolling.

## Settings on this site

Choose **Shortcuts** at the bottom of any page (it’s called **Settings** on touch screens), or press `?`. Two switches sit at the top:

- **Animations:** turns off moving text, entrances, and logo tricks. If your device already asks for reduced motion, they are off, and the switch says so.
- **Single-key shortcuts:** turns off the one-letter keys listed below it. This helps if you use speech input or sometimes press keys by accident. `⌘ K` or `Ctrl K` still opens search.

Your choices are remembered in this browser only. The [privacy page](https://thewayiai.com/privacy/) explains what is stored.

## Using a keyboard

`Tab` moves through links and controls in reading order, with a visible focus outline. On topic pages, “Skip to the text” and “Skip to the outline” links come first. Dialogs and the topic list keep focus inside until you close them with `Esc`, and focus returns to where you were.

The shortcut list shows a few faster ways around, such as `J` and `K` to step through chapters. They are optional; everything also works with ordinary keys.

## Pictures and colour

The wildlife portraits are decorative. Each animal is named in the text beside it, so screen readers skip the images rather than describing them. Text meets the WCAG contrast ratio in both designs and both themes, and nothing relies on colour alone to carry meaning.

## Known gaps

- Some link cards shorten their description to two lines. The full text opens the page they link to.
- If you increase letter spacing on a very narrow screen, the logo can push the GitHub link past the edge of the header.
- I check the site with automated tools and by hand in browsers, but I haven’t yet tested it with every screen reader.

## Tell me what gets in your way

If something is hard to use, please [open an issue on GitHub](https://github.com/tkarakai/the-way-i-ai/issues) or reach me as [tkarakai](https://github.com/tkarakai). Tell me the page and what happened; I’d much rather hear about it than not.
