# UI/UX Standards Context — ATS Rocket (Sprint 1)

> **S1-002** | Owner: Esmeralda
> Rules: S1-BR-001, S1-BR-006, S1-BR-008

---

## 1. Chosen Navigation Model 

### Navigation Structure 
#### (application uses a left sidebar navigation) 

- Home
- Dashboard 
- Applications 
- Profile 
- Settings 
#### The sidebar remains visible at all times and may collapse to icon-only mode. Navigation labels must remain consistent across all pages. 

#### If breadcrumbs are implemented it should not be used on top-level pages. 

--- 

## 2. Dashboard Interaction Model 

### Purpose: The dashboard is a data visualization serving as the user’s command center. Dashboard should be sync with an recent updates within the application tracking system. 
- Recent Activity 
- Applications 
- Status 
- Follow-Ups 
#### Example:  Applications -> Edit Application 

### Table Behaviour 
#### All data tables should support search, sorting, pagination 
#### Preferred columns: 
- Role 
- Document + Document Type
- Date Applied 
- Last Updates 
- Company
- Status 

##### Tables should allow horizontal scrolling. If any, hide low-priority columns. 

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

 
### Cards On Dashboard
#### Contains minimal information  
- Dashboard summary 
- Application status 
- Resume upload

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
Page Title: 
32px 
Bold 

Section Title: 
24px 
Semi-bold 

Body Text:
14-16px 
Regular 

Helper Text: 
12-14px 
Regular 

```

### Prioritize scannability over decoration. 

### Color System: 
- Page color scheme is Red, Sand, Gray 

#### Successful messages - Sand (#af9a58) 

#### Warning messages, Pending actions -  Silver (#c0c0c0)

#### Error messages, Delete action - Crimson (#dc143c)

--- 

## 5. Consistency Rules  
 
### Theme Consistency 

#### Both light and dark modes must provide similar functionality. 
- Preserve hierarchy and spacing 
- No feature different between themes 

### Naming Consistency 
#### Concepts that are similar should use the same label such as Application. 

### Status Consistency 
#### Status names should remain consistent. 
- Saved 
- Applied 
- Offer 
- Rejected 
- Withdrawn 

### Action Consistency 
- Search should be above tables 
- Filters should be beside Search 
- Save button on right and Cancel button on left of Save 

### Accessibility Rules 
- Buttons must be labeled. 
- Colors should be consistent with the color scheme. 
- Keyboard navigation must be supported. 

### Approved Component Libary (Shadcn) 
#### Preferred Components: 
- Cards
- Button
- Table 
- Toast 
- Select 

--- 
