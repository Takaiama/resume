(() => {
  "use strict";

  document.documentElement.classList.add("js");

  const MONTHS = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
  ];

  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
    );

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  const isMonthValue = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

  const monthLabel = (value) => {
    const [year, month] = value.split("-").map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  };

  const parseMonth = (value) => {
    const [year, month] = value.split("-").map(Number);
    return year * 12 + month - 1;
  };

  const currentMonth = () => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  };

  const plural = (number, forms) => {
    const remainder10 = number % 10;
    const remainder100 = number % 100;
    if (remainder10 === 1 && remainder100 !== 11) return forms[0];
    if (remainder10 >= 2 && remainder10 <= 4 && !(remainder100 >= 12 && remainder100 <= 14)) {
      return forms[1];
    }
    return forms[2];
  };

  const formatDuration = (totalMonths) => {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const parts = [];

    if (years) parts.push(`${years} ${plural(years, ["год", "года", "лет"])}`);
    if (months) parts.push(`${months} ${plural(months, ["месяц", "месяца", "месяцев"])}`);
    return parts.join(" ") || "меньше месяца";
  };

  /* ---------- jobs.txt: разбор ---------- */

  const KEY_ALIASES = {
    "начало": "start",
    "с": "start",
    "start": "start",
    "конец": "end",
    "по": "end",
    "end": "end",
    "организация": "org",
    "компания": "org",
    "org": "org",
    "город": "city",
    "city": "city",
    "должность": "title",
    "позиция": "title",
    "title": "title",
    "отрасль": "industry",
    "industry": "industry",
    "подпись": "summary",
    "описание": "summary",
    "summary": "summary",
    "объект": "object",
    "объекты": "object",
    "object": "object",
    "разделы": "stack",
    "stack": "stack",
    "пункт": "bullet",
    "задача": "bullet",
    "bullet": "bullet",
  };

  const parseJobs = (rawText) => {
    const text = rawText.replace(/^\uFEFF/, "");
    const jobs = [];
    let current = null;

    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) return;

      if (/^\[\s*(работа|job)\s*\]$/i.test(line)) {
        current = { objects: [], bullets: [] };
        jobs.push(current);
        return;
      }

      const colon = line.indexOf(":");
      if (colon < 1 || !current) return;

      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      const field = KEY_ALIASES[key];
      if (!field) return;

      if (field === "object") {
        if (value) current.objects.push(value);
        return;
      }
      if (field === "bullet") {
        if (value) current.bullets.push(value);
        return;
      }
      current[field] = value;
    });

    return jobs
      .filter((job) => job.org && isMonthValue((job.start || "").trim()))
      .map((job) => {
        const end = (job.end || "").trim();
        return {
          ...job,
          start: job.start.trim(),
          end: isMonthValue(end) ? end : "",
        };
      });
  };

  /* ---------- jobs.txt: отрисовка ---------- */

  const renderJob = (job) => {
    const period = job.end
      ? `<time datetime="${esc(job.start)}">${capitalize(monthLabel(job.start))}</time>
            <span>— <time datetime="${esc(job.end)}">${monthLabel(job.end)}</time></span>`
      : `<time datetime="${esc(job.start)}">${capitalize(monthLabel(job.start))}</time>
            <span>— настоящее время</span>`;

    const objects = job.objects.length
      ? `<div class="projects">${job.objects
          .map((text, index) => {
            const wide =
              job.objects.length % 2 === 1 && index === job.objects.length - 1 ? " project--wide" : "";
            return `<div class="project${wide}">
                <h4><span>${String(index + 1).padStart(2, "0")}</span>${esc(text)}</h4>
              </div>`;
          })
          .join("")}</div>`
      : "";

    const stack = job.stack
      ? `<p class="stack"><strong>Разделы:</strong> ${esc(job.stack)}</p>`
      : "";

    const bullets = job.bullets.length
      ? `<ul>${job.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : "";

    return `<article class="job" data-start="${esc(job.start)}"${
      job.end ? ` data-end="${esc(job.end)}"` : ""
    }>
          <div class="job__period">
            ${period}
            <small class="job__duration"></small>
          </div>
          <div class="job__body">
            <div class="job__topline">
              <div>
                <h3>${esc(job.org)}</h3>
                ${job.city ? `<p class="job__location">${esc(job.city)}</p>` : ""}
              </div>
              ${job.title ? `<p class="job__title">${esc(job.title)}</p>` : ""}
            </div>
            ${job.industry ? `<p class="job__industry">${esc(job.industry)}</p>` : ""}
            ${job.summary ? `<p class="job__summary">${esc(job.summary)}</p>` : ""}
            ${objects}
            ${stack}
            ${bullets}
          </div>
        </article>`;
  };

  const loadJobs = async () => {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;

    try {
      const response = await fetch("jobs.txt", { cache: "no-store" });
      if (!response.ok) return;
      const jobs = parseJobs(await response.text());
      if (!jobs.length) return;
      timeline.innerHTML = jobs.map(renderJob).join("");
    } catch (error) {
      /* файл недоступен (например, страница открыта с диска) — остаётся версия из index.html */
    }
  };

  /* ---------- сроки и общий стаж ---------- */

  const updateDurations = () => {
    const occupiedMonths = new Set();

    document.querySelectorAll(".job[data-start]").forEach((job) => {
      const start = parseMonth(job.dataset.start);
      const end = job.dataset.end ? parseMonth(job.dataset.end) : currentMonth();
      const duration = job.querySelector(".job__duration");

      if (end < start) return;
      if (duration) duration.textContent = formatDuration(end - start + 1);
      for (let month = start; month <= end; month += 1) occupiedMonths.add(month);
    });

    const total = document.querySelector(".experience-total");
    if (total && occupiedMonths.size) {
      total.textContent = `Опыт работы — ${formatDuration(occupiedMonths.size)}`;
    }
  };

  /* ---------- возраст ---------- */

  const initAge = () => {
    const ageNode = document.querySelector("[data-age]");
    if (!ageNode) return;

    const [year, month, day] = (ageNode.dataset.birth || "1994-12-13").split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const beforeBirthday =
      today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
    if (beforeBirthday) age -= 1;
    ageNode.textContent = `${age} ${plural(age, ["год", "года", "лет"])}`;
  };

  /* ---------- появление блоков при скролле ---------- */

  const initReveal = () => {
    const revealNodes = document.querySelectorAll(".reveal");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealNodes.forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
      observer.observe(node);
    });
  };

  /* ---------- печать в PDF ---------- */

  const initPrint = () => {
    document.querySelectorAll("[data-print]").forEach((button) => {
      button.addEventListener("click", () => window.print());
    });
  };

  const init = async () => {
    await loadJobs();
    updateDurations();
    initAge();
    initReveal();
    initPrint();
  };

  init();
})();
