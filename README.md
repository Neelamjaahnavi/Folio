# Folio — Portfolio Builder

A complete single-page web application for creating and managing developer/designer portfolios.

## Tech Stack

| Layer      | Technology         |
|------------|--------------------|
| Markup     | HTML5              |
| Styling    | CSS3 (custom vars) |
| Logic      | AngularJS 1.8.3    |
| Data       | JSON + localStorage|
| Config     | XML-ready structure|

## Features

### Auth System
- **Register** — name, username, email, password (with validation)
- **Login** — email + password
- **Persistent sessions** via localStorage
- **Logout** with session clear

### Portfolio Builder
- Create multiple portfolios per account
- Edit: title, role, bio, location, experience
- Pick avatar emoji & card color theme
- Add/remove skills (tag system)
- Add/remove projects (title, stack, description, live URL, GitHub)
- Contact & social links: email, website, GitHub, LinkedIn, Twitter, Dribbble
- **Live preview** tab with browser mockup

### UX Details
- Toast notification system
- Deep-clone editing (discard without saving)
- Confirm dialog before deletion
- Responsive layout

## How to Run

1. Place `index.html` and `app.js` in the same folder
2. Open `index.html` in any modern browser
   - No build step, no server required
   - Works offline (CDN for AngularJS only)

## Data Format (JSON in localStorage)

```json
// Key: "folio_users"
[
  {
    "name": "Alex",
    "username": "alexdev",
    "email": "alex@example.com",
    "password": "••••••",
    "portfolios": [
      {
        "name": "Dev Portfolio",
        "role": "Full Stack Developer",
        "bio": "I build things for the web.",
        "location": "Hyderabad, India",
        "experience": 3,
        "emoji": "🧑‍💻",
        "theme": "linear-gradient(135deg,#1c1f28,#2a2000)",
        "skills": ["React", "Node.js", "Python"],
        "projects": [
          {
            "title": "My App",
            "desc": "A cool application",
            "stack": "React, Express",
            "url": "https://myapp.com",
            "github": "https://github.com/alex/myapp"
          }
        ],
        "email": "alex@example.com",
        "github": "github.com/alexdev",
        "linkedin": "linkedin.com/in/alexdev"
      }
    ]
  }
]
```

## File Structure

```
portfolio-builder/
├── index.html   ← Full UI with AngularJS directives
├── app.js       ← AngularJS module, controller, all logic
└── README.md    ← This file
```