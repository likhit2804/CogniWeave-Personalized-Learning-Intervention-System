from abc import ABC, abstractmethod

from agents.shared_memory import SharedMemory


class BaseAgent(ABC):
    name = "base-agent"

    @abstractmethod
    def run(self, memory: SharedMemory, knowledge_base) -> None:
        """Read from shared memory, update it, and append trace messages."""
