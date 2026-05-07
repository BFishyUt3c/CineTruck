#!/bin/bash
python3 fake_data.py && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
