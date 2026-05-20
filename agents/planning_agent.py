from agents.base_agent import BaseAgent
from agents.shared_memory import SharedMemory


class PlanningAgent(BaseAgent):
    name = "planning-agent"

    def run(self, memory: SharedMemory, knowledge_base) -> None:
        hours = max(memory.profile.get("available_hours_per_week", 6), 3)
        activities = memory.selected_intervention.get("activities", [])

        memory.weekly_plan = [
            {"day": "Day 1", "focus": activities[0] if activities else "Concept review", "minutes": 45},
            {"day": "Day 2", "focus": activities[1] if len(activities) > 1 else "Guided practice", "minutes": 45},
            {"day": "Day 4", "focus": "Independent problem solving", "minutes": 60},
            {"day": "Day 6", "focus": "Checkpoint attempt and reflection", "minutes": min(hours * 10, 60)},
        ]
        memory.add_trace(
            self.name,
            "Built a short weekly plan around the selected intervention.",
        )
