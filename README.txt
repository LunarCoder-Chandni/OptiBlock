# OptiBlock — Flask Prototype

A Flask app prototype for smart railway block planning.

## Files

- `app.py` — Flask application entry point
- `templates/index.html` — page structure and UI
- `static/style.css` — all visual styling
- `static/app.js` — sample data, scheduling logic, optimization simulation and interactions
- `requirements.txt` — Python dependency list

## Run

Install Flask, then run the app.

1. `pip install -r requirements.txt`
2. `python app.py`
3. Open `http://127.0.0.1:5000`

For a smoother development experience, open the folder in VS Code and run the Flask app from the integrated terminal.

## Prototype flow

Dashboard → Requests → Schedule → Conflicts

The prototype simulates:
- priority scoring
- safety-critical weighting
- cross-department request fusion
- traffic-cost based scheduling
- deadline-aware placement
- manual/siloed baseline comparison
- conflict escalation
- interactive block explanations

## Important

The railway data is synthetic demo data. The NDLS–CNB corridor is illustrative and the prototype is not an operational railway control system.
