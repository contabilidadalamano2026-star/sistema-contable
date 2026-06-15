from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from api import auth, businesses, transactions, products, employees, contacts, bank_accounts, subusers, opportunities

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="C.A.L.M API V2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(businesses.router)
app.include_router(transactions.router)
app.include_router(products.router)
app.include_router(employees.router)
app.include_router(contacts.router)
app.include_router(bank_accounts.router)
app.include_router(subusers.router)
app.include_router(opportunities.router)

@app.get("/")
def root():
    return {"message": "API V2 Running"}

