# AI Engineering Guidelines

1. Read project specs before making changes.
2. Follow approved architecture and existing conventions.
3. Do not introduce unnecessary dependencies.
4. Do not modify unrelated files.
5. Implement features in small, reviewable increments.
6. Write tests alongside implementation.
7. Never assume generated code is correct; critically review it.
8. Explain architectural decisions and trade-offs.
9. Never hardcode secrets or credentials (`.env.example` only).
10. Run relevant tests before declaring a task complete.

If a requirement is ambiguous:
- Identify the ambiguity.
- Suggest a reasonable assumption.
- Document the assumption.
- Proceed without unnecessary clarification.
