import {useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import {getErrorMessage} from '../../../app/errors';
import {categoriesApi} from '../api/categoriesApi';
import {getNextCategorySortOrder} from './useCategoriesController';

interface UseCategoryActionsArgs {
  categories: Category[];
  refreshCategories: () => Promise<Category[]>;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function useCategoryActions({categories, refreshCategories, setLoading, showToast}: UseCategoryActionsArgs) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormColor, setCatFormColor] = useState('#fb7185');
  const [catFormSort, setCatFormSort] = useState(0);

  function handleOpenCategoryModal(cat: Category | null) {
    setEditingCategory(cat);
    if (cat) {
      setCatFormName(cat.name);
      setCatFormColor(cat.color);
      setCatFormSort(cat.sortOrder);
    } else {
      setCatFormName('');
      setCatFormColor('#fb7185');
      setCatFormSort(getNextCategorySortOrder(categories));
    }
    setIsCategoryModalOpen(true);
  }

  async function handleSaveCategory() {
    if (!catFormName.trim()) {
      showToast('分类名称不能为空呀', 'error');
      return;
    }

    try {
      setLoading(true);
      if (editingCategory) {
        await categoriesApi.updateCategory(editingCategory.id, {name: catFormName, color: catFormColor, sortOrder: catFormSort});
        showToast('分类更新完成');
      } else {
        await categoriesApi.createCategory({name: catFormName, color: catFormColor, sortOrder: catFormSort});
        showToast('新分类创建成功');
      }
      setIsCategoryModalOpen(false);
      await refreshCategories();
    } catch (err) {
      showToast(getErrorMessage(err, '操作分类失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!window.confirm('您确定要删去该分类？关联任务将变为无分类状态。')) return;
    try {
      setLoading(true);
      await categoriesApi.deleteCategory(id);
      showToast('分类已顺利移除');
      await refreshCategories();
    } catch (err) {
      showToast(getErrorMessage(err, '删除分类失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return {
    isCategoryModalOpen,
    editingCategory,
    catFormName,
    catFormColor,
    catFormSort,
    setIsCategoryModalOpen,
    setCatFormName,
    setCatFormColor,
    setCatFormSort,
    handleOpenCategoryModal,
    handleDeleteCategory,
    handleSaveCategory,
  };
}
