<script lang="ts">
  import Viewport from './viewport/Viewport.svelte'
  import Toolbar from './ui/Toolbar.svelte'
  import PartPalette from './ui/PartPalette.svelte'
  import PropertiesPanel from './ui/PropertiesPanel.svelte'
  import HierarchyPanel from './ui/HierarchyPanel.svelte'
  import BooleanPanel from './ui/BooleanPanel.svelte'
  import StatusBar from './ui/StatusBar.svelte'

  let rightTab = $state<'props' | 'boolean' | 'hierarchy'>('props')
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
      <div class="tab-bar">
        <button class="tab-btn" class:active={rightTab === 'props'} onclick={() => rightTab = 'props'}>プロパティ</button>
        <button class="tab-btn" class:active={rightTab === 'boolean'} onclick={() => rightTab = 'boolean'}>ブーリアン</button>
        <button class="tab-btn" class:active={rightTab === 'hierarchy'} onclick={() => rightTab = 'hierarchy'}>階層</button>
      </div>
      <div class="tab-content">
        {#if rightTab === 'props'}
          <PropertiesPanel />
        {:else if rightTab === 'boolean'}
          <BooleanPanel />
        {:else}
          <HierarchyPanel />
        {/if}
      </div>
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
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .tab-btn {
    flex: 1;
    padding: 8px 4px;
    font-size: 11px;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-surface);
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .viewport-area {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
