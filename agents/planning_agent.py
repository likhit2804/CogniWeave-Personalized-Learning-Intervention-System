from agents.state import GraphState


class PlanningAgentNode:
    """LangGraph node that builds a weekly study plan."""

    def __call__(self, state: GraphState) -> dict:
        # 1. Retrieve data from State
        profile = state["profile"]
        intervention = state["selected_intervention"]
        critic_feedback = state.get("critic_feedback")

        hours = max(profile.get("available_hours_per_week", 6), 3)
        activities = intervention.get("activities", [])

        # 2. Build weekly plan (expand if critic asked for more)
        plan = [
            {"day": "Day 1", "focus": activities[0] if activities else "Concept review", "minutes": 45},
            {"day": "Day 2", "focus": activities[1] if len(activities) > 1 else "Guided practice", "minutes": 45},
            {"day": "Day 4", "focus": "Independent problem solving", "minutes": 60},
            {"day": "Day 6", "focus": "Checkpoint attempt and reflection", "minutes": min(hours * 10, 60)},
        ]

        # If critic asked for more focus blocks, add extra days
        if critic_feedback:
            plan.append({"day": "Day 3", "focus": "Spaced review of weak areas", "minutes": 30})
            plan.append({"day": "Day 5", "focus": "Mixed practice with related concepts", "minutes": 40})

        # 3. Return the key updates to the GraphState
        return {
            "weekly_plan": plan,
            "trace": state["trace"] + [{"agent": "planning-agent", "message": "Built a weekly plan around the selected intervention."}],
        }
