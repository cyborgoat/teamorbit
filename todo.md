# teamorbit

## Project Overview

teamorbit is a backend service for managing teams members, events, announcements, news and blog posts. It is a microservice architecture that allows you to create, manage, and track teams members, events, announcements, news and blog posts.

## Features

- Users: Create, manage, and track members (Superuser, Admin, User).
  - Attributes: Username, Full Name, Email, Password, Role, Status, Created At, Updated At.
  - Permissions: Superuser, Admin, User.
  - Status: Active, Inactive, Pending, Suspended, Deleted.  
- Events: Create, manage, and track events.
  - Attributes: Title, Description, Start Date, End Date, Location, Created At, Updated At.
- Announcements: Create, manage, and track announcements.
  - Attributes: Title, Author, Description, Created At, Updated At.
- News: Create, manage, and track news.
  - Attributes: Title, Author, Tags, Content, Created At, Updated At.
- Blog Posts(markdown format): Create, manage, and track blog posts.
  - Attributes: Title, Author, Tags, Content, Created At, Updated At.

## Architecture

The project is a microservice architecture that allows you to create, manage, and track teams members, events, announcements, news and blog posts.

## Tech Stack

- Backend: NestJS
- Database: Sqlite
- ORM: Prisma
- Authentication: JWT
- Authorization: RBAC
- Logging: Pino
- Testing: Jest
- Documentation: Swagger
- Monitoring: Prometheus
- Alerting: Alertmanager
