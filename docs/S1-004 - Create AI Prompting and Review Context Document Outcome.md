  
**S1-004** | Owner: Brittney  

**Sprint 1 Rules:**
* S1-BR-001 – User authentication is required for all protected application routes  
* S1-BR-006 – All user-scoped records must be isolated by owner identity  
* S1-BR-008 – Ownership enforcement must be implemented server-side (frontend            checks are not sufficient)

---

### **Purpose** 

This document is to help the team use AI tools to our advantage (Claude, Copilot, ChatGPT, etc) to generate, review, and approve code before merging into the main branch. It will help our project have consistent code, safe and mergeable.

### **Always tell your prompt:**

* What file/feature are you working on  
* The specific Tech stack: FastAPI, React \+ Shadcn, etc   
* And who the current user is if the feature touches user data  
  **Weak Prompt:**

| *“Write a function to get user jobs.”* |
| :---- |

  **Strong Prompt:**

| *“Write a FastAPI route `GET /jobs` using SQLAlchemy that only returns jobs belonging to the currently authenticated user. Use `current_user = Depends(get_current_user)` and filter by `owner_id == current_user.id`. Return 403 if unauthenticated.”* |
| :---- |

### **Reviewing AI Output** 

Read the prompt before running. AI can generate code that skips edge cases. 

* Can the database query filter by the current user  
* If the errors are handled   
  *If the answer is no- fix it before committing* 

### **Testing** 

* AI output is not done until there is a test. The test must include a failure case or code outputs like in API code 403, 401, etc  
  **AI to write the test:**

| *“"Write a pytest test for this route. Include one test for an unauthenticated request and one where a different user tries to access the data.”* |
| :---- |


### **Before Merging** 

*   
* Test passes  
* CI passes  
* Reviews should be human-made  
* Avoid many changes all at one – unless it's **absolutely** necessary   
