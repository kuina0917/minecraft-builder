<script lang="ts">
  import Viewport from './viewport/Viewport.svelte'
  import Toolbar from './ui/Toolbar.svelte'
  import PartPalette from './ui/PartPalette.svelte'
  import PropertiesPanel from './ui/PropertiesPanel.svelte'
  import HierarchyPanel from './ui/HierarchyPanel.svelte'
  import StatusBar from './ui/StatusBar.svelte'
</script>

<div class="app-layout">
  <Toolbar />
  <div class="main-area">
    <aside class="panel left-panel">
      <PartPalette />
    </aside>
    <main class="viewport-area">
      <Viewport />
    </main>
    <aside class="panel right-panel">
      <PropertiesPanel />
      <HierarchyPanel />
    </aside>
  </div>
  <StatusBar />
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .panel {
    width: var(--panel-width);
    min-width: var(--panel-width);
    background: var(--bg-panel);
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .left-panel {
    border-left: none;
    border-right: 1px solid var(--border);
  }

  .right-panel {
    border-left: 1px solid var(--border);
    border-right: none;
  }

  .viewport-area {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
