from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"


def draw_on_canvas(page, selector: str) -> None:
    canvas = page.locator(selector)
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    assert box is not None

    points = [
        (box["x"] + 120, box["y"] + 180),
        (box["x"] + 170, box["y"] + 120),
        (box["x"] + 230, box["y"] + 220),
        (box["x"] + 300, box["y"] + 90),
    ]

    canvas.dispatch_event(
        "pointerdown",
        {"pointerId": 1, "clientX": points[0][0], "clientY": points[0][1]},
    )

    for x, y in points[1:]:
        canvas.dispatch_event(
            "pointermove",
            {"pointerId": 1, "clientX": x, "clientY": y},
        )

    canvas.dispatch_event(
        "pointerup",
        {"pointerId": 1, "clientX": points[-1][0], "clientY": points[-1][1]},
    )


def save_glyph(page, glyph: str) -> None:
    page.get_by_role("button", name=glyph, exact=True).click()
    draw_on_canvas(page, "canvas")
    page.get_by_role("button", name=f"Save {glyph}", exact=True).click()
    page.wait_for_timeout(600)


with sync_playwright() as playwright:
    Path("artifacts").mkdir(exist_ok=True)
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1600})
    page.goto(BASE_URL, wait_until="domcontentloaded")

    page.get_by_role("heading", name="Create your character set first.").wait_for()
    page.get_by_role("link", name="Create character set").click()

    page.get_by_role("heading", name="Your handwriting library").wait_for()

    save_glyph(page, "A")
    save_glyph(page, "a")
    save_glyph(page, "0")
    save_glyph(page, ".")
    save_glyph(page, "?")
    save_glyph(page, "!")

    page.get_by_role("link", name="Back to notes").click()
    page.get_by_role("heading", name="Your notes").wait_for()
    page.get_by_role("button", name="New note").click()

    page.locator('input[placeholder="Untitled note"]').fill("April note")
    page.locator("textarea").fill("Aa0?!")
    page.get_by_role("button", name="Save and create link").click()
    share_input = page.locator(".share-row input")
    share_input.wait_for()
    share_url = share_input.input_value()

    page.get_by_role("link", name="Back to notes").click()
    page.get_by_role("heading", name="Your notes").wait_for()
    page.screenshot(path=str(Path("artifacts") / "dashboard.png"), full_page=True)

    recipient = browser.new_page(viewport={"width": 1440, "height": 1400})
    recipient.goto(share_url, wait_until="domcontentloaded")
    recipient.get_by_role("button", name="Open envelope").click()
    recipient.wait_for_timeout(2200)
    recipient.screenshot(path=str(Path("artifacts") / "reveal.png"), full_page=True)

    print(share_url)
    browser.close()
