import os
import json

base = "knowledge_base/topics"

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

# --- Python OOP ---
pack = "python_oop"
d = f"{base}/{pack}"

write_json(f"{d}/manifest.json", {
    "topic_id": pack,
    "version": "1.0",
    "description": "Python Object-Oriented Programming concepts"
})
write_json(f"{d}/concept_graph.json", {
    "topic_id": pack,
    "concepts": [
        {"id": "classes", "label": "Classes and Objects", "description": "Defining custom data types with state and behavior."},
        {"id": "inheritance", "label": "Inheritance", "description": "Deriving new classes from existing ones."},
        {"id": "polymorphism", "label": "Polymorphism", "description": "Treating different types uniformly."}
    ]
})
write_json(f"{d}/misconceptions.json", {
    "topic_id": pack,
    "items": [
        {
            "id": "instance_vs_class_var",
            "concept_id": "classes",
            "label": "Confusing instance variables with class variables",
            "error_tags": ["variable_scope_error"]
        }
    ]
})
write_json(f"{d}/interventions.json", {
    "topic_id": pack,
    "rules": [
        {
            "id": "fix_var_scope",
            "concept_id": "classes",
            "misconception_id": "instance_vs_class_var",
            "strategy": "Visualizing memory models",
            "activities": ["Draw the class namespace vs instance namespace"]
        }
    ]
})
write_json(f"{d}/problems.json", {
    "topic_id": pack,
    "items": [
        {"id": "oop_001", "concept_id": "classes", "text": "Define a class with an instance variable.", "difficulty": 1}
    ]
})
write_json(f"{d}/evaluation_rules.json", {
    "classes": [
        {"rule": "Must correctly assign to self.var in __init__", "threshold": 0.8}
    ]
})

# --- Biology Cell Biology ---
pack = "biology_cell_biology"
d = f"{base}/{pack}"

write_json(f"{d}/manifest.json", {
    "topic_id": pack,
    "version": "1.0",
    "description": "Cell biology and organelles"
})
write_json(f"{d}/concept_graph.json", {
    "topic_id": pack,
    "concepts": [
        {"id": "mitochondria", "label": "Mitochondria", "description": "Organelles that generate ATP."},
        {"id": "nucleus", "label": "Nucleus", "description": "Organelle that contains genetic material."}
    ]
})
write_json(f"{d}/misconceptions.json", {
    "topic_id": pack,
    "items": [
        {
            "id": "powerhouse_only",
            "concept_id": "mitochondria",
            "label": "Thinking mitochondria only make energy and have no other function",
            "error_tags": ["oversimplification"]
        }
    ]
})
write_json(f"{d}/interventions.json", {
    "topic_id": pack,
    "rules": [
        {
            "id": "broaden_mito_function",
            "concept_id": "mitochondria",
            "misconception_id": "powerhouse_only",
            "strategy": "Case study analysis",
            "activities": ["Analyze a metabolic disease involving mitochondria"]
        }
    ]
})
write_json(f"{d}/problems.json", {
    "topic_id": pack,
    "items": [
        {"id": "bio_001", "concept_id": "mitochondria", "text": "Name 3 functions of the mitochondria.", "difficulty": 1}
    ]
})
write_json(f"{d}/evaluation_rules.json", {
    "mitochondria": [
        {"rule": "Identify at least two distinct functions of mitochondria", "threshold": 0.8}
    ]
})

# --- Expand SQL ---
pack = "sql_query_reasoning"
d = f"{base}/{pack}"
try:
    with open(f"{d}/concept_graph.json", "r") as f:
        cg = json.load(f)
        if not any(c["id"] == "subqueries" for c in cg.get("concepts", [])):
            cg["concepts"].append({"id": "subqueries", "label": "Subqueries", "description": "Queries inside other queries.", "prerequisites": ["basic_select"]})
    write_json(f"{d}/concept_graph.json", cg)
    
    with open(f"{d}/misconceptions.json", "r") as f:
        mc = json.load(f)
        if not any(m["id"] == "subquery_vs_join" for m in mc.get("items", [])):
            mc["items"].append({
                "id": "subquery_vs_join",
                "concept_id": "subqueries",
                "label": "Overusing subqueries instead of JOINs",
                "error_tags": ["subquery_performance_error"]
            })
    write_json(f"{d}/misconceptions.json", mc)
    
    with open(f"{d}/interventions.json", "r") as f:
        intv = json.load(f)
        if not any(r["id"] == "refactor_subquery_to_join" for r in intv.get("rules", [])):
            intv["rules"].append({
                "id": "refactor_subquery_to_join",
                "concept_id": "subqueries",
                "misconception_id": "subquery_vs_join",
                "strategy": "Query Rewriting",
                "activities": ["Rewrite the failing subquery as a JOIN and compare execution plans."]
            })
    write_json(f"{d}/interventions.json", intv)
except Exception as e:
    print("Error expanding sql:", e)

print("Done")
