export const DEMO_SEED_LABEL = "partnerships-crm-demo-v1";

export const demoFixtures = {
  users: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "partnerships.demo@ubcbiztech.com",
      firstName: "Partnerships",
      lastName: "Demo",
      role: "admin",
      team: "partnerships",
    },
  ],
  companies: [
    {
      id: "22222222-2222-4222-8222-222222222201",
      name: "Linear",
      website: "https://linear.app",
      linkedin: "https://www.linkedin.com/company/linear-app",
      tier: "target",
      tags: ["saas", "devtools", DEMO_SEED_LABEL],
      notes: "Design-forward dev tooling company; strong fit for technical recruiting and product talks.",
      isAlumni: false,
    },
    {
      id: "22222222-2222-4222-8222-222222222202",
      name: "Vercel",
      website: "https://vercel.com",
      linkedin: "https://www.linkedin.com/company/vercel",
      tier: "warm",
      tags: ["cloud", "frontend", DEMO_SEED_LABEL],
      notes: "Good fit for web infrastructure, AI app deployment, and startup engineering content.",
      isAlumni: false,
    },
    {
      id: "22222222-2222-4222-8222-222222222203",
      name: "Northstar Product Studio",
      website: "https://example.com/northstar",
      linkedin: "https://www.linkedin.com/company/northstar-product-studio",
      tier: "alumni",
      tags: ["alumni", "product", DEMO_SEED_LABEL],
      notes: "Fictional alumni-led product studio for local demo flows.",
      isAlumni: true,
    },
  ],
  contacts: [
    {
      id: "33333333-3333-4333-8333-333333333301",
      companyName: "Linear",
      firstName: "Maya",
      lastName: "Chen",
      role: "University Recruiting",
      email: "maya.chen@example.linear.app",
      linkedin: "https://www.linkedin.com/in/maya-chen-demo",
      notes: "Primary contact for student event sponsorship.",
      isPrimary: true,
    },
    {
      id: "33333333-3333-4333-8333-333333333302",
      companyName: "Linear",
      firstName: "Theo",
      lastName: "Kapoor",
      role: "Engineering Manager",
      email: "theo.kapoor@example.linear.app",
      linkedin: "https://www.linkedin.com/in/theo-kapoor-demo",
      notes: "Potential speaker for a product engineering fireside chat.",
      isPrimary: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333303",
      companyName: "Vercel",
      firstName: "Amelia",
      lastName: "Tran",
      role: "Developer Relations",
      email: "amelia.tran@example.vercel.com",
      linkedin: "https://www.linkedin.com/in/amelia-tran-demo",
      notes: "Interested in workshops with a deployable student project.",
      isPrimary: true,
    },
    {
      id: "33333333-3333-4333-8333-333333333304",
      companyName: "Northstar Product Studio",
      firstName: "Noah",
      lastName: "Singh",
      role: "Founder",
      email: "noah.singh@example.northstar.test",
      linkedin: "https://www.linkedin.com/in/noah-singh-demo",
      notes: "BizTech alum; can route intros to local product leaders.",
      isPrimary: true,
    },
  ],
  events: [
    {
      id: "44444444-4444-4444-8444-444444444401",
      name: "Blueprint 2026",
      year: 2026,
      startDate: "2026-09-19",
      endDate: "2026-09-20",
      outreachStartDate: "2026-05-15",
      sponsorshipGoal: 1200000,
      tierConfigs: [
        { id: "startup", label: "Startup", amount: 150000 },
        { id: "growth", label: "Growth", amount: 300000 },
        { id: "title", label: "Title", amount: 600000 },
      ],
      description: "BizTech's product and technology conference demo record.",
      notes: `Seeded by ${DEMO_SEED_LABEL}.`,
    },
    {
      id: "44444444-4444-4444-8444-444444444402",
      name: "Product Studio Night 2026",
      year: 2026,
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      outreachStartDate: "2026-08-01",
      sponsorshipGoal: 300000,
      tierConfigs: [
        { id: "partner", label: "Partner", amount: 100000 },
        { id: "presenting", label: "Presenting", amount: 250000 },
      ],
      description: "Small-format product case night for sponsor demos.",
      notes: `Seeded by ${DEMO_SEED_LABEL}.`,
    },
  ],
  sponsorships: [
    {
      id: "55555555-5555-4555-8555-555555555501",
      companyName: "Linear",
      eventName: "Blueprint 2026",
      primaryContactEmail: "maya.chen@example.linear.app",
      ownerEmail: "partnerships.demo@ubcbiztech.com",
      amount: 600000,
      tier: "Title",
      status: "in_conversation",
      role: "Title sponsor",
      followUpDate: "2026-05-22",
      startDate: "2026-09-19",
      endDate: "2026-09-20",
      notes: "Requested updated audience numbers and sample sponsor activations.",
    },
    {
      id: "55555555-5555-4555-8555-555555555502",
      companyName: "Vercel",
      eventName: "Blueprint 2026",
      primaryContactEmail: "amelia.tran@example.vercel.com",
      ownerEmail: "partnerships.demo@ubcbiztech.com",
      amount: 300000,
      tier: "Growth",
      status: "pitched",
      role: "Workshop sponsor",
      followUpDate: "2026-05-29",
      startDate: "2026-09-19",
      endDate: "2026-09-20",
      notes: "Workshop angle: build and deploy a recruiter-facing portfolio app.",
    },
    {
      id: "55555555-5555-4555-8555-555555555503",
      companyName: "Northstar Product Studio",
      eventName: "Product Studio Night 2026",
      primaryContactEmail: "noah.singh@example.northstar.test",
      ownerEmail: "partnerships.demo@ubcbiztech.com",
      amount: 100000,
      tier: "Partner",
      status: "confirmed",
      role: "Case sponsor",
      followUpDate: null,
      startDate: "2026-11-05",
      endDate: "2026-11-05",
      notes: "Confirmed alumni support; needs invoice once budget is final.",
    },
  ],
  documents: [
    {
      id: "66666666-6666-4666-8666-666666666601",
      companyName: "Linear",
      partnerEmail: "maya.chen@example.linear.app",
      eventName: "Blueprint 2026",
      sponsorshipId: "55555555-5555-4555-8555-555555555501",
      title: "Linear Blueprint 2026 Proposal",
      type: "proposal",
      status: "sent",
      url: "https://drive.google.com/example/linear-blueprint-proposal",
      fileName: "linear-blueprint-2026-proposal.pdf",
      notes: `Demo link seeded by ${DEMO_SEED_LABEL}.`,
    },
    {
      id: "66666666-6666-4666-8666-666666666602",
      companyName: "Northstar Product Studio",
      partnerEmail: "noah.singh@example.northstar.test",
      eventName: "Product Studio Night 2026",
      sponsorshipId: "55555555-5555-4555-8555-555555555503",
      title: "Northstar Case Night Agreement",
      type: "agreement",
      status: "draft",
      url: "https://drive.google.com/example/northstar-case-night-agreement",
      fileName: "northstar-case-night-agreement.docx",
      notes: `Demo link seeded by ${DEMO_SEED_LABEL}.`,
    },
  ],
  interactions: [
    {
      id: "77777777-7777-4777-8777-777777777701",
      userEmail: "partnerships.demo@ubcbiztech.com",
      companyName: "Linear",
      partnerEmail: "maya.chen@example.linear.app",
      sponsorshipId: "55555555-5555-4555-8555-555555555501",
      type: "email",
      direction: "outbound",
      subject: "Blueprint 2026 sponsorship package",
      notes: "Sent initial package and asked about recruiting goals for September.",
      contactedAt: "2026-05-16T17:30:00.000Z",
      followUpDate: "2026-05-22",
      source: "gmail",
      externalMessageId: "demo-linear-msg-1",
      externalThreadId: "demo-linear-thread-1",
    },
    {
      id: "77777777-7777-4777-8777-777777777702",
      userEmail: "partnerships.demo@ubcbiztech.com",
      companyName: "Linear",
      partnerEmail: "maya.chen@example.linear.app",
      sponsorshipId: "55555555-5555-4555-8555-555555555501",
      type: "call",
      direction: "inbound",
      subject: "Budget and audience fit",
      notes: "Maya asked for last year's attendee breakdown and activation menu.",
      contactedAt: "2026-05-19T20:00:00.000Z",
      followUpDate: "2026-05-22",
      source: "manual",
      externalMessageId: null,
      externalThreadId: null,
    },
    {
      id: "77777777-7777-4777-8777-777777777703",
      userEmail: "partnerships.demo@ubcbiztech.com",
      companyName: "Vercel",
      partnerEmail: "amelia.tran@example.vercel.com",
      sponsorshipId: "55555555-5555-4555-8555-555555555502",
      type: "linkedin",
      direction: "outbound",
      subject: "Workshop sponsorship intro",
      notes: "Shared a shorter workshop-specific pitch after LinkedIn connection.",
      contactedAt: "2026-05-17T18:45:00.000Z",
      followUpDate: "2026-05-29",
      source: "linkedin",
      externalMessageId: null,
      externalThreadId: null,
    },
  ],
  emailTemplates: [
    {
      id: "88888888-8888-4888-8888-888888888801",
      name: "Blueprint sponsor warm intro",
      description: "Warm outbound template for companies with some prior BizTech context.",
      subjectTemplate: "{{eventName}} x {{companyName}}",
      bodyTemplate:
        "Hi {{firstName}},\n\nI'm reaching out from UBC BizTech about {{eventName}}. Given {{companyName}}'s work with product-minded technical teams, I thought there could be a strong fit for a sponsorship or workshop partnership.\n\nWould you be open to a quick call next week?",
      createdByEmail: "partnerships.demo@ubcbiztech.com",
    },
    {
      id: "88888888-8888-4888-8888-888888888802",
      name: "Follow-up after sponsor call",
      description: "Short follow-up after a discovery call.",
      subjectTemplate: "Following up on {{eventName}}",
      bodyTemplate:
        "Hi {{firstName}},\n\nThanks again for chatting about {{eventName}}. I attached the sponsor package and highlighted the options we discussed.\n\nHappy to adjust the package around {{companyName}}'s hiring and developer community goals.",
      createdByEmail: "partnerships.demo@ubcbiztech.com",
    },
  ],
};

export function moneyToCents(dollars) {
  if (!Number.isFinite(dollars)) {
    throw new Error(`Money amount must be a finite number: ${dollars}`);
  }

  return Math.round(dollars * 100);
}

export function keyBy(items, getKey, label) {
  const keyed = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      throw new Error(`${label} fixture is missing a key`);
    }
    if (keyed.has(key)) {
      throw new Error(`Duplicate ${label} fixture key: ${key}`);
    }
    keyed.set(key, item);
  }

  return keyed;
}

export function assertValidFixtureSet(fixtures) {
  const companiesByName = keyBy(fixtures.companies, (company) => company.name, "company");
  const usersByEmail = keyBy(fixtures.users, (user) => user.email, "user");
  const contactsByEmail = keyBy(fixtures.contacts, (contact) => contact.email, "contact");
  const eventsByName = keyBy(fixtures.events, (event) => event.name, "event");
  const sponsorshipsById = keyBy(fixtures.sponsorships, (sponsorship) => sponsorship.id, "sponsorship");

  for (const contact of fixtures.contacts) {
    if (!companiesByName.has(contact.companyName)) {
      throw new Error(`Contact ${contact.email} references unknown company: ${contact.companyName}`);
    }
  }

  for (const sponsorship of fixtures.sponsorships) {
    if (!companiesByName.has(sponsorship.companyName)) {
      throw new Error(`Sponsorship ${sponsorship.id} references unknown company: ${sponsorship.companyName}`);
    }
    if (!eventsByName.has(sponsorship.eventName)) {
      throw new Error(`Sponsorship ${sponsorship.id} references unknown event: ${sponsorship.eventName}`);
    }
    if (!contactsByEmail.has(sponsorship.primaryContactEmail)) {
      throw new Error(`Sponsorship ${sponsorship.id} references unknown contact: ${sponsorship.primaryContactEmail}`);
    }
    if (!usersByEmail.has(sponsorship.ownerEmail)) {
      throw new Error(`Sponsorship ${sponsorship.id} references unknown owner: ${sponsorship.ownerEmail}`);
    }
  }

  for (const document of fixtures.documents) {
    if (!companiesByName.has(document.companyName)) {
      throw new Error(`Document ${document.id} references unknown company: ${document.companyName}`);
    }
    if (!contactsByEmail.has(document.partnerEmail)) {
      throw new Error(`Document ${document.id} references unknown contact: ${document.partnerEmail}`);
    }
    if (!eventsByName.has(document.eventName)) {
      throw new Error(`Document ${document.id} references unknown event: ${document.eventName}`);
    }
    if (!sponsorshipsById.has(document.sponsorshipId)) {
      throw new Error(`Document ${document.id} references unknown sponsorship: ${document.sponsorshipId}`);
    }
  }

  for (const interaction of fixtures.interactions) {
    if (!usersByEmail.has(interaction.userEmail)) {
      throw new Error(`Interaction ${interaction.id} references unknown user: ${interaction.userEmail}`);
    }
    if (!companiesByName.has(interaction.companyName)) {
      throw new Error(`Interaction ${interaction.id} references unknown company: ${interaction.companyName}`);
    }
    if (!contactsByEmail.has(interaction.partnerEmail)) {
      throw new Error(`Interaction ${interaction.id} references unknown contact: ${interaction.partnerEmail}`);
    }
    if (!sponsorshipsById.has(interaction.sponsorshipId)) {
      throw new Error(`Interaction ${interaction.id} references unknown sponsorship: ${interaction.sponsorshipId}`);
    }
  }

  for (const template of fixtures.emailTemplates) {
    if (!usersByEmail.has(template.createdByEmail)) {
      throw new Error(`Email template ${template.id} references unknown creator: ${template.createdByEmail}`);
    }
  }
}
