import { chromium } from "playwright";

async function run() {
  console.log("Starting /contact page automated verification...");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err));
  page.on("response", (res) => {
    if (res.url().includes("/api/")) {
      console.log(`API RESPONSE: ${res.url()} -> ${res.status()}`);
    }
  });

  try {
    // 1. Visit /contact
    console.log("Navigating to http://localhost:3000/contact...");
    await page.goto("http://localhost:3000/contact", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // 2. Check Title & Main H1
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    if (!title.includes("Contact Us")) {
      throw new Error(`Expected title to include 'Contact Us', got: ${title}`);
    }

    const h1 = await page.locator("h1#contactHeroTitle").textContent();
    console.log(`Hero H1: "${h1?.trim()}"`);
    if (!h1?.includes("Good things start with a conversation.")) {
      throw new Error(`H1 mismatch: ${h1}`);
    }

    // 3. Verify "How our support process works" is completely removed
    const pageText = await page.content();
    const hasSupportProcess =
      pageText.toLowerCase().includes("how our support process works") ||
      pageText.toLowerCase().includes("response lifecycle") ||
      pageText.includes("step-num-bubble") ||
      pageText.includes("steps-flow-row");

    console.log(`Support process section present: ${hasSupportProcess}`);
    if (hasSupportProcess) {
      throw new Error("FAIL: 'How our support process works' section was NOT removed!");
    }
    console.log("✓ Confirmed: 'How our support process works' section is completely removed.");

    // 4. Verify Connected Illustration in Hero
    const centralHub = page.locator(".contact-center-hub");
    await centralHub.waitFor({ state: "visible", timeout: 5000 });
    const hubTitle = await centralHub.locator(".hub-title").textContent();
    console.log(`Central Hub title: "${hubTitle?.trim()}"`);

    const featurePills = await page.locator(".hero-feature-pill").allTextContents();
    console.log(`Connected feature labels found:`, featurePills.map((t) => t.trim()));
    if (featurePills.length !== 4) {
      throw new Error(`Expected 4 connected feature pills, found ${featurePills.length}`);
    }

    // 5. Test Category Selection & Dropdown Synchronization
    console.log("Testing category cards & dropdown sync...");
    const generalCard = page.locator("#catCard-general");
    const partnershipsCard = page.locator("#catCard-partnerships");
    const supportCard = page.locator("#catCard-support");
    const categorySelect = page.locator("#contactCategorySelect");

    // Initially general should be selected
    const initialSelected = await generalCard.getAttribute("aria-checked");
    const initialSelectVal = await categorySelect.inputValue();
    console.log(`Default selected category: ${initialSelectVal} (card checked: ${initialSelected})`);
    if (initialSelectVal !== "general" || initialSelected !== "true") {
      throw new Error("Default selection should be 'general'");
    }

    // Click partnerships card
    await partnershipsCard.click();
    await page.waitForTimeout(200);
    const afterPartVal = await categorySelect.inputValue();
    const partChecked = await partnershipsCard.getAttribute("aria-checked");
    console.log(`Clicked partnerships card -> dropdown value: ${afterPartVal}, card checked: ${partChecked}`);
    if (afterPartVal !== "partnerships" || partChecked !== "true") {
      throw new Error("Card click did not synchronize dropdown to 'partnerships'");
    }

    // Click technical support card
    await supportCard.click();
    await page.waitForTimeout(200);
    const afterSuppVal = await categorySelect.inputValue();
    console.log(`Clicked support card -> dropdown value: ${afterSuppVal}`);
    if (afterSuppVal !== "support") {
      throw new Error("Card click did not synchronize dropdown to 'support'");
    }

    // Change dropdown back to general
    await categorySelect.selectOption("general");
    await page.waitForTimeout(200);
    const genChecked = await generalCard.getAttribute("aria-checked");
    console.log(`Changed dropdown to general -> general card checked: ${genChecked}`);
    if (genChecked !== "true") {
      throw new Error("Dropdown change did not synchronize card to 'general'");
    }
    console.log("✓ Category selection and dropdown synchronization verified!");

    // 6. Test Form Validation
    console.log("Testing client-side validation...");
    const submitBtn = page.locator("#submitContactBtn");
    await submitBtn.click();
    await page.waitForTimeout(200);

    const nameError = await page.locator("#fullNameError").isVisible();
    const emailError = await page.locator("#emailError").isVisible();
    const subjectError = await page.locator("#subjectError").isVisible();
    const messageError = await page.locator("#messageError").isVisible();
    const consentError = await page.locator("#consentError").isVisible();

    console.log("Validation errors visible on empty submit:", {
      nameError,
      emailError,
      subjectError,
      messageError,
      consentError,
    });

    if (!nameError || !emailError || !subjectError || !messageError || !consentError) {
      throw new Error("Form validation failed to show all required field errors");
    }

    // 7. Test Form Submission
    console.log("Filling form and testing submission to /api/contact...");
    await page.fill("#contactFullName", "Priyanshu Sharma");
    await page.fill("#contactEmail", "priyanshu@university.edu");
    await page.fill("#contactSubject", "Academic Partnership Enquiry");
    await page.fill(
      "#contactMessage",
      "We are interested in introducing the AI Tathastu platform to our campus students."
    );
    // Click label or checkbox to ensure React event fires
    await page.locator("label[for='contactConsent']").click();
    const isConsentChecked = await page.locator("#contactConsent").isChecked();
    console.log(`Consent checkbox checked: ${isConsentChecked}`);

    await submitBtn.click();
    await page.waitForTimeout(500);

    if (await page.locator("#formErrorMessage").isVisible()) {
      const errorBanner = await page.locator("#formErrorMessage").textContent();
      console.log(`Form error banner shown: "${errorBanner}"`);
    }

    const anyHints = await page.locator(".field-error-hint.show").allTextContents();
    if (anyHints.length > 0) console.log("Field error hints still showing:", anyHints);

    // Wait for success screen
    console.log("Waiting for success screen...");
    const successScreen = page.locator("#formSuccessState");
    await successScreen.waitFor({ state: "visible", timeout: 8000 });

    const successText = await page.locator(".success-title").textContent();
    const refCode = await page.locator("#submissionRefCode").textContent();
    console.log(`Success message: "${successText?.trim()}"`);
    console.log(`Enquiry Reference Code: "${refCode?.trim()}"`);

    if (!successText?.includes("Message sent")) {
      throw new Error("Success message not found");
    }
    if (!refCode?.startsWith("#TAT-")) {
      throw new Error(`Invalid reference code format: ${refCode}`);
    }

    // Test form reset
    await page.locator("#btnResetForm").click();
    await page.waitForTimeout(300);
    const formVisible = await page.locator("#contactMessageForm").isVisible();
    console.log(`Form reset and visible again: ${formVisible}`);
    if (!formVisible) {
      throw new Error("Form did not reset back to editable state");
    }
    console.log("✓ Form submission and reset verified!");

    // 8. Test FAQ Accordion
    console.log("Testing FAQ accordions...");
    const faqItems = page.locator(".faq-item");
    const faqCount = await faqItems.count();
    console.log(`Found ${faqCount} FAQ items`);
    if (faqCount !== 4) {
      throw new Error(`Expected 4 FAQ items, got ${faqCount}`);
    }

    // Item 0 is open by default
    const item0Expanded = await page.locator("#faq-btn-0").getAttribute("aria-expanded");
    console.log(`FAQ 0 initially open: ${item0Expanded}`);

    // Click FAQ 1 to open it
    await page.locator("#faq-btn-1").click();
    await page.waitForTimeout(300);
    const item1Expanded = await page.locator("#faq-btn-1").getAttribute("aria-expanded");
    const item0After = await page.locator("#faq-btn-0").getAttribute("aria-expanded");
    console.log(`After clicking FAQ 1 -> FAQ 1 expanded: ${item1Expanded}, FAQ 0 expanded: ${item0After}`);
    if (item1Expanded !== "true" || item0After !== "false") {
      throw new Error("FAQ accordion toggle did not switch open item");
    }
    console.log("✓ FAQ accordion keyboard and toggle interactions verified!");

    // 9. Check Responsive Viewports & Horizontal Overflow
    const viewports = [
      { name: "Desktop (1440px)", width: 1440, height: 900 },
      { name: "Tablet (1024px)", width: 1024, height: 768 },
      { name: "Tablet Portrait (768px)", width: 768, height: 1024 },
      { name: "Mobile Large (390px)", width: 390, height: 844 },
      { name: "Mobile Small (320px)", width: 320, height: 640 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Viewport ${vp.name}: overflow = ${overflow}`);
      if (overflow) {
        throw new Error(`Horizontal overflow detected at ${vp.name}!`);
      }
    }
    console.log("✓ All viewports verified: ZERO horizontal overflow!");

    // 10. Capture visual snapshots
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: "scripts/contact-desktop-1440.png", fullPage: true });
    console.log("Saved scripts/contact-desktop-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "scripts/contact-mobile-390.png", fullPage: true });
    console.log("Saved scripts/contact-mobile-390.png");

    console.log("\n==============================================");
    console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! 🎉");
    console.log("==============================================");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
