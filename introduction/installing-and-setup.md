# Installing & Setup

This section ensures users understand how to properly install and set up the framework, emphasizing **best practices for customization and updates**.

> [!danger]
> Unlike standard Unreal Engine plugins, this framework is designed as a **standalone project**, similar to Lyra. **It is not meant to be added to an existing project.** Instead, developers should start their game development within this framework and modify it to suit their needs.

***

### **Downloading the Project**

You can obtain the framework via the **Unreal Engine Marketplace** (once released).

> [!info]
> This project would require at least **Unreal Engine 5.5**

***

### **Opening the Project**

* Open Unreal Engine 5 (latest stable version recommended)
* Select Open Project
* Navigate to the downloaded folder and select the .uproject file
* If prompted, convert the project to the latest engine version
* Let Unreal compile and open the editor

> [!success]
> The first load may take a few minutes due to shader compilation and plugin initialization.

***

### **Understanding the Project Structure**

Before diving in, a quick look at where things are:

* `📂 Content/`
  * Contains core assets and any modified Lyra framework code. **Generally, avoid modifying these directly to ensure easier updates.**
* `📂 Plugins/`
  * This is a standard Unreal Engine plugins directory.
* `📂 Plugins/GameFeatures/`
  * **This is the primary location for modular content.** Each subdirectory here is a separate **Game Feature Plugin**.
  * **Core Framework Plugins:** You'll find the foundational plugins of this asset here (e.g., `ShooterBase/`, `TetrisInventory/`, `TrueFirstPerson/`).
  * **Example Game Mode Plugins:** The pre-built game modes (e.g., `TeamDeathmatch/`, `Arena/`, `BattleRoyale/`) also reside here as individual Game Feature Plugins.
  * **Your Custom Plugins:** When you create new game modes or features, they will also become subdirectories in `Plugins/GameFeatures/`.

**Core Philosophy:** This framework is built on modularity using **Game Feature Plugins** and **Experiences**.

* **Game Feature Plugins:** Package distinct gameplay systems (core mechanics or specific game modes). Their dependencies on other plugins are defined in their respective `.uplugin` files.
* **Experiences (`ULyraExperienceDefinition`):** Data Assets (usually found within a Game Feature Plugin's `Content` folder) that define _what_ game mode to run, _which_ Game Features to activate for that session, default player setups, and UI.

> [!success]
> ### Best Practice: Working with the Framework
> 
> If you're just getting started with Unreal Engine or aren't yet comfortable managing complex changes in large codebases (especially when it comes to using Git for merging and tracking changes), **please follow the recommended customization paths** below to keep your project clean and easy to update.
> 
> #### Recommended Way to Customize
> 
> * **Add Major Features / New Game Modes / Big Changes**\
>   Create a **new Game Feature Plugin** for your content. This keeps your work separate from the core framework and example content, making updates smoother and easier to manage.
> *   **Tweak Example Game Modes**\
>     If you want to build on an existing example:
> 
>     1. Create a new Game Feature Plugin.
>     2. Copy any relevant assets (like `ULyraExperienceDefinition`, `ULyraPawnData`, `ULyraExperienceActionSets`) from the example plugin.
>     3. Modify those copies in your plugin.
> 
>     This approach ensures the original examples stay untouched, making it easier to compare, learn from, or update them later.
> 
> #### Modifying the Core Framework (ShooterBase, TetrisInventory, etc.)
> 
> The core plugins are designed to be extended—not edited directly. If you modify them, you’re entering “merge conflict territory,” and future updates will be harder to apply.
> 
> #### A Word to Experienced Developers
> 
> If you're comfortable with Unreal's systems and Git workflows, and you truly need to change something deep in the core systems that can’t be handled through subclassing, configuration, or Game Features—go for it. But understand:
> 
> * **You’re now responsible** for manually merging changes when updating this asset pack.
> * Modifying core systems is a valid choice for advanced use cases, but it requires a solid understanding of Unreal's architecture and version control workflows. If that’s not familiar territory, it’s best to stick with extension-based methods to avoid potential maintenance headaches
> 
> In short: **extend, don’t edit—unless you know exactly what you're doing.**

***

### How To Create a Game Feature Plugin

1. In **Unreal Engine**, go to `Edit → Plugins`
2. Click `Add`
3. Choose **Game Feature Plugin**
4. Select **C++** as the base (even if you won’t use C++ yet—it allows expansion later)
5. Name your plugin (e.g., `MyShooterExpansion`)
6. Add necessary dependencies (see below)

> [!success]
> In the editor, the modified lyra code is inside the content folder, the game feature plugins (including the ones you create) are inside the plugin folder. If you want to add or modify c++ code of game features you can find them in `/Plugins/GameFeatures/ProjectName` .\
> \
> If you can't see any plugins in the editor, make sure you tick "Show Plugin Content", in the settings of your content browser.

#### Common Plugin Dependencies:

* `GameplayAbilities`
* `ModularGameplay`
* `GameplayMessageRouter`
* `AsyncMixin`
* `CommonUI`, `CommonGame`
* `EnhancedInput`
* `LyraExampleContent`
* Relevant core features like `ShooterBase`, `TetrisInventory`, etc.

> [!info]
> You can manage these dependencies manually in the `.uplugin` file or via the Game Feature Data Asset.

<img src=".gitbook/assets/GameFeature.png" alt="" title="">

> [!info]
> If you don't like images and want a video (I don't blame you), this is a [good guide](https://www.youtube.com/watch?v=AaGxHtQ0okw). One thing to keep in mind is that is based on Lyra, not my plugin (will make a video later if necessary), so the plugin dependencies used in the video are not in this project, like `ShooterCore`.

***

### Important Note About Activation

After creating your plugin, **you won’t see any gameplay changes right away.** That’s expected.

To make your plugin do anything, you must:

* Create an **Experience Definition**
* Assign it to a map or load it dynamically

These concepts are explained fully in the next page, [Quick Start Guide](quick-start-guide.md),  and the [Game Framework & Experiences](../base-lyra-modified/gameframework-and-experience/) section.

Or you can check [Lyra's guide](https://dev.epicgames.com/community/learning/tutorials/rdW2/unreal-engine-how-to-create-a-new-game-feature-plugin-and-experience-in-lyra) if you prefer a quick step by step guide

***

Now that your project is set up and your workspace is ready, let’s launch a game mode and explore how Experiences and modular features come together.
