# UI/UX Standards Context — ATS Rocket (Sprint 1)

> **S1-002** | Owner: Esmeralda
> Rules: S1-BR-001, S1-BR-006, S1-BR-008

---

## 1. Navigation Model 

### Navigation Structure 
#### The application uses a persistent left sidebar navigation combined with a dashboard-first layout. 

- Dashboard 
- Analytics 
- Profile 
- Settings 

#### Behavior 
- Sidebar remains visible on desktop screens. 
- Active section is clearly highlighted. 
- Navigation labels remain consistent across all pages. 
- Navigation state persists between page transitions. 

--- 

## 2. Dashboard Interaction Model 

### Purpose: The dashboard is a data visualization serving as the user’s command center. Dashboard should be sync with an recent updates within the application tracking system. Not a storage area.
- Primary content is presented as scrollable cards. 
#### It provides: 
- Recent Activity 
- Application status  
- Follow-Ups 
- Quick access to documents 

 
##### Card behavior has lightweight previews only.

--- 

## 3. Component Usage Rules 

### Buttons 

#### Primary Buttons: 
- Save Changes 
- Upload Resume 

#### Secondary Buttons:
- Cancel 
- Back 

#### Danger Buttons: 
- Delete Application
- Remove Document 

### Notifications 
#### Toast notifications 
- Save successfully 
- Upload successfully 

#### Inline error messages 
- data entry issues 
- file upload error 

### Loading States 
#### Preferred: 
- Skeleton loaders (placeholder content that mimics the layout of the expected data) 
- Disable actions 

#### Not Recommended: 
- Blank Screen 
- Spinner/Loading Indicator 

### Forms 
#### Rules: 
- Required filed should be marked with *. 
- Save action consistently. 
- Have group related fields together. 
- Labels should be clear and above inputs. 

### Empty States 
- "No application found. Add you application." 
- "No documents uploaded." 

--- 

## 4. Spacing & Typography Conventions 

### Spacing : 
#### Use an 8px spacing scale. 
- 8px Small spacing 
- 16px Standard spacing 
- 24px Section spacing
- 32 px Large section spacing

### Page Layout : 
#### Standard page structure 

```
Page Title 
Page Description 

Primary Actions 

Content Area 
```

### Typography 
``` 
Page Title -> 32px Bold 

Section Title -> 24px Semi-bold 

Body Text -> 14-16px Regular 

Helper Text -> 12-14px Regular 

```

### Priority: readability and scanning, no decorative typography.
--- 
## 5. Color System

### Primary Brand Palette 
- Deep Blue: #003C78
- Ocean Blue: #046A97
- Soft Background: #F8FAFC
- Accent Coral: #FF6138

--- 

## 6. Consistency Rules  
 
### Theme Consistency 
- Light and dark modes must preserve: 
    - Layout structure 
    - Spacing system 
    - Component behavior 
- No feature differences between themes. 

### Naming Consistency 
- Use consistent terms across systems. 

### Status Consistency 
#### Status names should remain consistent. 
- Saved 
- Applied 
- Offer 
- Rejected 
- Withdrawn 

### Action Consistency 

- Search -> Above Tables 
- Filters -> Next to search 
- Primary action -> top-right aligned 
- Cancel -> left of Save button 

### Accessibility Rules 
- All buttons must be labeled. 
- Colors should be consistent with the color scheme. 
- Keyboard navigation must be supported. 
 

--- 
