# Item Container Architecture

This section covers the structural foundations of the ItemContainer system, the abstractions that make container-agnostic operations possible.

***

### What You'll Learn

| Page                   | Description                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Container Contract | The `ILyraItemContainerInterface` that all containers implement. Covers the core methods, slot behaviors, and how different containers fulfill the same contract. |
| Slot Descriptors       | How polymorphic slot identification works via `FAbilityData_SourceItem`. Different containers have different slot types, but the system handles them uniformly.   |
| Blueprint API          | The `UItemContainerFunctionLibrary` that exposes container operations to Blueprints. When to use the function library vs transactions.                            |
| Design Philosophy      | Why the system is designed this way. Trade-offs, alternatives considered, and the reasoning behind key decisions.                                                 |

***

### The Two Layers

Understanding the architecture means understanding two distinct layers:

#### The C++ Layer: `ILyraItemContainerInterface`

This is the contract that every container implements. It defines:

* How items are added, removed, and moved
* How slots are queried and validated
* How occupied slots behave (swap, stack, combine, reject)
* How the container participates in prediction

If you're creating a new container type in C++, you implement this interface.

#### The Blueprint Layer: `UItemContainerFunctionLibrary`

The interface uses C++ constructs (like `FPredictionKey`) that don't translate well to Blueprints. The function library provides Blueprint-friendly wrappers:

* Slot resolution and item queries
* Transaction execution
* Server-only container manipulation
* Permission-aware operations

If you're working in Blueprints, you use the function library. The transactions page covers how these connect.

***

### Recommended Reading Order

**For understanding the system:**

1. Start with The Container Contract to see what containers do
2. Read Slot Descriptors to understand how slots work across types
3. Check Blueprint API if you'll be working in Blueprints

**For creating custom containers:**

1. The Container Contract for requirements
2. Design Philosophy for context on decisions you'll make
3. Then move to Creating Containers for step-by-step guidance

***

### Next Steps

Start with The Container Contract to understand the foundation.
